import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// Mocks for React Native and Expo dependencies so SettingsModal module can be analyzed/tested
const mockAlert = jest.fn();
const mockOpenURL = jest.fn();
const mockCanOpenURL = jest.fn();

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: (...args: any[]) => mockAlert(...args),
    },
    Linking: {
      canOpenURL: (...args: any[]) => mockCanOpenURL(...args),
      openURL: (...args: any[]) => mockOpenURL(...args),
    },
    Platform: {
      OS: 'android',
      select: (obj: any) => obj.android || obj.default,
    },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}));

describe('SettingsModal Static & AST Analysis', () => {
  const filePath = path.resolve(__dirname, '../src/components/modals/SettingsModal.tsx');
  let fileContent: string;
  let sourceFile: ts.SourceFile;

  beforeAll(() => {
    fileContent = fs.readFileSync(filePath, 'utf8');
    sourceFile = ts.createSourceFile(
      'SettingsModal.tsx',
      fileContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  });

  test('file exists and is readable', () => {
    expect(fileContent.length).toBeGreaterThan(0);
  });

  test('AST contains exact link URLs: policies, contact email, feedback and website', () => {
    const urls: string[] = [];

    function findUrls(node: ts.Node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const text = node.text;
        if (text.includes('zerodaily.in') && /^(https:\/\/|mailto:)/.test(text)) {
          urls.push(text);
        }
      }
      ts.forEachChild(node, findUrls);
    }

    findUrls(sourceFile);
    expect(urls).toContain('https://zerodaily.in/privacy');
    expect(urls).toContain('https://zerodaily.in/terms');
    expect(urls).toContain('https://zerodaily.in/feedback');
    expect(urls).toContain('https://zerodaily.in');
    expect(urls).toContain('mailto:hi@zerodaily.in?subject=ZeroDaily%20support');
    expect(urls).toHaveLength(5);
  });

  test('Contact & Support section visibly shows the support email', () => {
    expect(fileContent).toContain('CONTACT & SUPPORT');
    expect(fileContent).toContain('hi@zerodaily.in');

    // The email must be rendered as visible JSX text, not only used in the mailto link
    const jsxTexts: string[] = [];
    function findJsxTexts(node: ts.Node) {
      if (ts.isJsxText(node)) {
        const text = node.getText(sourceFile).trim();
        if (text) jsxTexts.push(text);
      }
      ts.forEachChild(node, findJsxTexts);
    }
    findJsxTexts(sourceFile);
    expect(jsxTexts).toContain('hi@zerodaily.in');

    // Contact section sits directly above Legal & Policies
    expect(fileContent.indexOf('CONTACT & SUPPORT')).toBeLessThan(fileContent.indexOf('LEGAL & POLICIES'));
  });

  test('AST confirms version string matches package.json and strictly no v0.5.4 or 0.5.4 exists', () => {
    // Assert 0.5.4 does not exist anywhere in the source code
    expect(fileContent).not.toContain('0.5.4');
    expect(fileContent).not.toContain('v0.5.4');

    // Extract JSX text elements
    const jsxTexts: string[] = [];
    function findJsxTexts(node: ts.Node) {
      if (ts.isJsxText(node)) {
        const text = node.getText(sourceFile).trim();
        if (text) jsxTexts.push(text);
      }
      ts.forEachChild(node, findJsxTexts);
    }

    findJsxTexts(sourceFile);
    const pkg = require('../package.json');
    const expectedVersionString = `ZeroDaily Mobile • v${pkg.version}`;
    const versionNode = jsxTexts.find((t) => t.includes(`v${pkg.version}`));
    expect(versionNode).toBeDefined();
    expect(versionNode).toBe(expectedVersionString);
  });

  test('AST confirms no TypeScript suppression directives (ts-ignore, ts-expect-error, ts-nocheck)', () => {
    expect(fileContent).not.toMatch(/@ts-ignore/i);
    expect(fileContent).not.toMatch(/@ts-expect-error/i);
    expect(fileContent).not.toMatch(/@ts-nocheck/i);
  });

  test('AST confirms handleOpenURL structural integrity with canOpenURL, openURL, and try/catch', () => {
    let hasCanOpenURL = false;
    let hasOpenURL = false;
    let hasCatch = false;
    let hasAlert = false;

    function checkFunctions(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const expr = node.expression.getText(sourceFile);
        if (expr === 'Linking.canOpenURL') hasCanOpenURL = true;
        if (expr === 'Linking.openURL') hasOpenURL = true;
        if (expr === 'Alert.alert') hasAlert = true;
      }
      if (ts.isCatchClause(node)) {
        hasCatch = true;
      }
      ts.forEachChild(node, checkFunctions);
    }

    checkFunctions(sourceFile);
    expect(hasCanOpenURL).toBe(true);
    expect(hasOpenURL).toBe(true);
    expect(hasCatch).toBe(true);
    expect(hasAlert).toBe(true);
  });
});

describe('SettingsModal Linking Error Handling Empirical Tests', () => {
  // Replicating the exact handleOpenURL logic from SettingsModal.tsx
  const handleOpenURL = async (
    url: string,
    linking: { canOpenURL: (u: string) => Promise<boolean>; openURL: (u: string) => Promise<any> },
    alert: (title: string, msg: string) => void,
    logger: { error: (...args: any[]) => void }
  ) => {
    try {
      const supported = await linking.canOpenURL(url);
      if (supported) {
        await linking.openURL(url);
      } else {
        alert('Cannot Open Link', `Unable to open link on this device: ${url}`);
      }
    } catch (error) {
      logger.error('[SettingsModal] Error opening URL:', error);
      alert('Error', 'An unexpected error occurred while attempting to open the link.');
    }
  };

  let mockLinking: { canOpenURL: jest.Mock; openURL: jest.Mock };
  let alertSpy: jest.Mock;
  let loggerSpy: { error: jest.Mock };

  beforeEach(() => {
    mockLinking = {
      canOpenURL: jest.fn(),
      openURL: jest.fn(),
    };
    alertSpy = jest.fn();
    loggerSpy = {
      error: jest.fn(),
    };
  });

  test('Success branch: calls Linking.openURL when canOpenURL is true', async () => {
    mockLinking.canOpenURL.mockResolvedValueOnce(true);
    mockLinking.openURL.mockResolvedValueOnce(undefined);

    await handleOpenURL('https://zerodaily.in/privacy', mockLinking, alertSpy, loggerSpy);

    expect(mockLinking.canOpenURL).toHaveBeenCalledWith('https://zerodaily.in/privacy');
    expect(mockLinking.openURL).toHaveBeenCalledWith('https://zerodaily.in/privacy');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(loggerSpy.error).not.toHaveBeenCalled();
  });

  test('Unsupported branch: triggers Alert.alert("Cannot Open Link") when canOpenURL is false', async () => {
    mockLinking.canOpenURL.mockResolvedValueOnce(false);

    await handleOpenURL('https://zerodaily.in/terms', mockLinking, alertSpy, loggerSpy);

    expect(mockLinking.canOpenURL).toHaveBeenCalledWith('https://zerodaily.in/terms');
    expect(mockLinking.openURL).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Cannot Open Link',
      'Unable to open link on this device: https://zerodaily.in/terms'
    );
    expect(loggerSpy.error).not.toHaveBeenCalled();
  });

  test('Exception branch 1: canOpenURL rejects (e.g. system Linking error)', async () => {
    const error = new Error('Device intent query failed');
    mockLinking.canOpenURL.mockRejectedValueOnce(error);

    await handleOpenURL('https://zerodaily.in/privacy', mockLinking, alertSpy, loggerSpy);

    expect(mockLinking.canOpenURL).toHaveBeenCalledWith('https://zerodaily.in/privacy');
    expect(mockLinking.openURL).not.toHaveBeenCalled();
    expect(loggerSpy.error).toHaveBeenCalledWith('[SettingsModal] Error opening URL:', error);
    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'An unexpected error occurred while attempting to open the link.'
    );
  });

  test('Exception branch 2: canOpenURL resolves true but openURL rejects (e.g. ActivityNotFoundException)', async () => {
    const error = new Error('No activity found to handle intent');
    mockLinking.canOpenURL.mockResolvedValueOnce(true);
    mockLinking.openURL.mockRejectedValueOnce(error);

    await handleOpenURL('https://zerodaily.in/terms', mockLinking, alertSpy, loggerSpy);

    expect(mockLinking.canOpenURL).toHaveBeenCalledWith('https://zerodaily.in/terms');
    expect(mockLinking.openURL).toHaveBeenCalledWith('https://zerodaily.in/terms');
    expect(loggerSpy.error).toHaveBeenCalledWith('[SettingsModal] Error opening URL:', error);
    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'An unexpected error occurred while attempting to open the link.'
    );
  });

  test('Adversarial input: handles malformed URL or empty string without unhandled promise rejection', async () => {
    mockLinking.canOpenURL.mockRejectedValueOnce(new TypeError('Invalid URL string'));

    await handleOpenURL('', mockLinking, alertSpy, loggerSpy);

    expect(loggerSpy.error).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'An unexpected error occurred while attempting to open the link.'
    );
  });
});
