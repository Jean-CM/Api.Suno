import { chromium } from 'rebrowser-playwright-core';
import * as cookie from 'cookie';
import yn from 'yn';

export type SunoWorkspaceCreateResult = {
  ok: boolean;
  name: string;
  url?: string;
  message?: string;
};

const browserArgs = () => {
  const args = [
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-features=site-per-process',
    '--disable-features=IsolateOrigins',
    '--disable-extensions',
    '--disable-infobars',
  ];

  if (yn(process.env.BROWSER_DISABLE_GPU, { default: false })) {
    args.push('--enable-unsafe-swiftshader', '--disable-gpu', '--disable-setuid-sandbox');
  }

  return args;
};

const addSunoCookies = async (context: any) => {
  const rawCookie = process.env.SUNO_COOKIE;
  if (!rawCookie) throw new Error('SUNO_COOKIE no está configurada en Render.');

  const parsed = cookie.parse(rawCookie);
  const cookies = Object.entries(parsed)
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => ({
      name,
      value: String(value),
      domain: '.suno.com',
      path: '/',
      sameSite: 'Lax' as const,
    }));

  await context.addCookies(cookies);
};

const clickIfVisible = async (page: any, locator: any, timeout = 3000) => {
  try {
    await locator.first().click({ timeout, force: true });
    return true;
  } catch {
    return false;
  }
};

const closePossiblePopups = async (page: any) => {
  await clickIfVisible(page, page.getByLabel(/close/i), 1200);
  await clickIfVisible(page, page.getByRole('button', { name: /close/i }), 1200);
  await page.keyboard.press('Escape').catch(() => undefined);
};

const openWorkspacesLibrary = async (page: any) => {
  const urls = [
    'https://suno.com/library?tab=workspaces',
    'https://suno.com/library/workspaces',
    'https://suno.com/library',
  ];

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);
    await closePossiblePopups(page);

    const clickedTab = await clickIfVisible(page, page.getByRole('tab', { name: /workspaces/i }), 2500)
      || await clickIfVisible(page, page.getByText(/^workspaces$/i), 2500);

    if (clickedTab) await page.waitForTimeout(1500);

    const hasNewWorkspace = await page.getByText(/new workspace|create new workspace/i).first().isVisible({ timeout: 4000 }).catch(() => false);
    if (hasNewWorkspace) return true;
  }

  return false;
};

const openCreateWorkspaceDialog = async (page: any) => {
  const candidates = [
    page.getByRole('button', { name: /new workspace/i }),
    page.getByText(/create new workspace/i),
    page.locator('button').filter({ hasText: /new workspace/i }),
    page.locator('[role="button"]').filter({ hasText: /new workspace/i }),
    page.locator('div').filter({ hasText: /^\s*\+\s*Create New Workspace\s*$/i }),
  ];

  for (const candidate of candidates) {
    const clicked = await clickIfVisible(page, candidate, 5000);
    if (clicked) {
      await page.waitForTimeout(2500);
      return true;
    }
  }

  return false;
};

const fillFirstVisibleTextbox = async (page: any, value: string) => {
  const candidates = [
    page.getByPlaceholder(/workspace|name|nombre|title|título/i),
    page.locator('input[name*="name" i]'),
    page.locator('input[placeholder*="name" i]'),
    page.locator('input[placeholder*="workspace" i]'),
    page.getByRole('textbox'),
    page.locator('input[type="text"]'),
    page.locator('textarea'),
  ];

  for (const candidate of candidates) {
    try {
      const first = candidate.first();
      await first.waitFor({ timeout: 5000 });
      await first.fill(value, { timeout: 5000 });
      return true;
    } catch {
      // Try next selector.
    }
  }

  return false;
};

const submitCreateWorkspace = async (page: any) => {
  const candidates = [
    page.getByRole('button', { name: /^create$/i }),
    page.getByRole('button', { name: /create workspace/i }),
    page.getByRole('button', { name: /save/i }),
    page.getByText(/^create$/i),
    page.getByText(/create workspace/i),
    page.getByText(/save/i),
  ];

  for (const candidate of candidates) {
    const clicked = await clickIfVisible(page, candidate, 5000);
    if (clicked) {
      await page.waitForTimeout(5000);
      return true;
    }
  }

  await page.keyboard.press('Enter').catch(() => undefined);
  await page.waitForTimeout(5000);
  return true;
};

export async function createSunoWorkspace(workspaceName: string): Promise<SunoWorkspaceCreateResult> {
  const name = workspaceName.trim();
  if (!name) throw new Error('El nombre del workspace no puede estar vacío.');

  const browser = await chromium.launch({
    args: browserArgs(),
    headless: yn(process.env.BROWSER_HEADLESS, { default: true }),
  });

  const context = await browser.newContext({
    locale: process.env.BROWSER_LOCALE || 'en',
    viewport: { width: 1600, height: 1000 },
  });

  try {
    await addSunoCookies(context);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);

    const libraryReady = await openWorkspacesLibrary(page);
    if (!libraryReady) {
      throw new Error('No pude abrir Library → Workspaces en Suno. Revisa si la sesión sigue vigente o si la URL cambió.');
    }

    const opened = await openCreateWorkspaceDialog(page);
    if (!opened) {
      throw new Error('No pude hacer clic en + New Workspace / Create New Workspace dentro de Library → Workspaces.');
    }

    const filled = await fillFirstVisibleTextbox(page, name);
    if (!filled) {
      throw new Error('No encontré el campo para escribir el nombre del workspace en Suno.');
    }

    await submitCreateWorkspace(page);

    const visible = await page.getByText(name, { exact: false }).first().isVisible({ timeout: 12000 }).catch(() => false);
    if (!visible) {
      throw new Error('Suno no confirmó visualmente el workspace creado. Revisa manualmente si quedó creado.');
    }

    return {
      ok: true,
      name,
      url: page.url(),
      message: 'Workspace creado o confirmado visualmente en Suno desde Library → Workspaces.',
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
