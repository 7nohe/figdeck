import type { TitlePrefixConfig } from "@figdeck/shared";
import agentsTemplate from "../templates/agents.md";
import aiRulesBodyTemplate from "../templates/ai-rules-body.md";
import claudeTemplate from "../templates/claude.md";
import copilotTemplate from "../templates/copilot.md";
import cursorTemplate from "../templates/cursor.mdc";
import initTemplate from "../templates/init.md";

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

/**
 * Get the AGENTS.md template for Codex CLI and general AI agents
 */
export function getAgentsTemplate(): string {
  return agentsTemplate.replaceAll("{{aiRulesBody}}", aiRulesBodyTemplate);
}

/**
 * Get the Claude Code template (.claude/rules/figdeck.md)
 */
export function getClaudeTemplate(): string {
  return claudeTemplate;
}

/**
 * Get the Cursor template (.cursor/rules/figdeck.mdc)
 */
export function getCursorTemplate(): string {
  return cursorTemplate.replaceAll("{{aiRulesBody}}", aiRulesBodyTemplate);
}

/**
 * Get the GitHub Copilot template (.github/instructions/figdeck.instructions.md)
 */
export function getCopilotTemplate(): string {
  return copilotTemplate.replaceAll("{{aiRulesBody}}", aiRulesBodyTemplate);
}
