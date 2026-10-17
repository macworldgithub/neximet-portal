import { defineConfig } from '@playwright/test';
import base from './playwright.ai.config.mjs';

export default defineConfig({ ...base, testDir: './tests/payroll', outputDir: './test-results/payroll' });
