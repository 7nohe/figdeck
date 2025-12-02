import initTemplate from "../templates/init.md";
import type { TitlePrefixConfig } from "./types.js";

/**
 * Template defaults configuration
 */
export interface TemplateDefaults {
  titlePrefix?: TitlePrefixConfig;
}

/**
 * Registry of template defaults keyed by template name
 * Users can define custom templates via frontmatter or extend this registry
 */
const templateRegistry: Record<string, TemplateDefaults> = {};

/**
 * Register a template with its defaults
 */
export function registerTemplate(
  name: string,
  defaults: TemplateDefaults,
): void {
  templateRegistry[name] = defaults;
}

/**
 * Get template defaults by name
 * Returns undefined if template is not registered
 */
export function getTemplateDefaults(
  templateName: string,
): TemplateDefaults | undefined {
  return templateRegistry[templateName];
}

/**
 * Check if a template is registered
 */
export function hasTemplate(templateName: string): boolean {
  return templateName in templateRegistry;
}

/**
 * Get all registered template names
 */
export function getRegisteredTemplates(): string[] {
  return Object.keys(templateRegistry);
}

/**
 * Get the init template for `figdeck init` command
 */
export function getInitTemplate(): string {
  return initTemplate;
}
