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

const clickIfVisible = async (page: any, locator: any, timeout = 2500) => {
  try {
    await locator.first().click({ timeout, force: true });
    return true;
  } catch {
    return false;
  }
};

const fillFirstVisibleTextbox = async (page: any, value: string) => {
  const candidates = [
    page.getByPlaceholder(/workspace|name|nombre|title|título/i),
    page.getByRole('textbox'),
    page.locator('input[type="text"]'),
    page.locator('textarea'),
  ];

  for (const candidate of candidates) {
    try {
      const first = candidate.first();
      await first.waitFor({ timeout: 3500 });
      await first.fill(value, { timeout: 3500 });
      return true;
    } catch {
      // Try next selector
    }
  }

  return false;
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
    viewport: { width: 1440, height: 1000 },
  });

  try {
    await addSunoCookies(context);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);

    await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3500);

    // Close optional popups that can block the workspace picker.
    await clickIfVisible(page, page.getByLabel(/close/i), 1500);
    await clickIfVisible(page, page.getByRole('button', { name: /close/i }), 1500);

    // If the menu is already visible, click Create New Workspace directly.
    let opened = await clickIfVisible(page, page.getByText(/create new workspace/i), 2500);

    // Otherwise try to open the workspace selector.
    if (!opened) {
      const selectorCandidates = [
        page.getByText(/my workspace/i),
        page.getByText(/workspace/i),
        page.locator('button').filter({ hasText: /workspace/i }),
        page.locator('[role="button"]').filter({ hasText: /workspace/i }),
      ];

      for (const selector of selectorCandidates) {
        const clicked = await clickIfVisible(page, selector, 2500);
        if (clicked) {
          await page.waitForTimeout(1500);
          opened = await clickIfVisible(page, page.getByText(/create new workspace/i), 5000);
          if (opened) break;
        }
      }
    }

    if (!opened) {
      throw new Error('No pude abrir la opción Create New Workspace en Suno. La UI pudo cambiar o la sesión no abrió la vista Create.');
    }

    const filled = await fillFirstVisibleTextbox(page, name);
    if (!filled) {
      throw new Error('No encontré el campo para escribir el nombre del workspace en Suno.');
    }

    const createButtons = [
      page.getByRole('button', { name: /^create$/i }),
      page.getByRole('button', { name: /create workspace/i }),
      page.getByRole('button', { name: /save/i }),
      page.getByText(/^create$/i),
      page.getByText(/create workspace/i),
      page.getByText(/save/i),
    ];

    let submitted = false;
    for (const button of createButtons) {
      submitted = await clickIfVisible(page, button, 5000);
      if (submitted) break;
    }

    if (!submitted) {
      throw new Error('No encontré el botón final para crear/guardar el workspace en Suno.');
    }

    await page.waitForTimeout(4500);

    const visible = await page.getByText(name, { exact: false }).first().isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) {
      throw new Error('Suno no confirmó visualmente el workspace creado. Revisa manualmente si quedó creado.');
    }

    return {
      ok: true,
      name,
      url: page.url(),
      message: 'Workspace creado o confirmado visualmente en Suno.',
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
