/**
 * Supported node types for cloning/instancing.
 */
export type CloneableNodeType =
  | "FRAME"
  | "GROUP"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE";

/**
 * Options for node lookup.
 */
export interface NodeLookupOptions {
  /** Allowed node types (default: all cloneable types) */
  allowedTypes?: CloneableNodeType[];
  /** Show figma.notify on error (default: false) */
  notifyOnError?: boolean;
  /** Custom error message prefix for logging */
  errorPrefix?: string;
}

const DEFAULT_ALLOWED_TYPES: CloneableNodeType[] = [
  "FRAME",
  "GROUP",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
];

/**
 * Create a node cache with lookup functionality.
 * Each cache instance maintains its own Map and failed Set.
 */
export function createNodeCache() {
  const cache = new Map<string, SceneNode | null>();
  const failedIds = new Set<string>();

  /**
   * Find a cloneable node by ID with caching.
   * Returns the node if found and valid, null otherwise.
   */
  async function findNode(
    nodeId: string,
    options: NodeLookupOptions = {},
  ): Promise<SceneNode | null> {
    const {
      allowedTypes = DEFAULT_ALLOWED_TYPES,
      notifyOnError = false,
      errorPrefix = "Node",
    } = options;

    // Check cache first
    if (cache.has(nodeId)) {
      return cache.get(nodeId) || null;
    }

    // Skip if already known to fail
    if (failedIds.has(nodeId)) {
      return null;
    }

    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        console.warn(`[figdeck] ${errorPrefix} "${nodeId}" not found`);
        failedIds.add(nodeId);
        if (notifyOnError) {
          figma.notify(`${errorPrefix} not found: ${nodeId}`, { error: true });
        }
        return null;
      }

      const nodeType = node.type as CloneableNodeType;

      // Handle COMPONENT_SET specially - return default variant
      // COMPONENT_SET cannot be cloned directly, must extract a variant
      if (nodeType === "COMPONENT_SET") {
        if (!allowedTypes.includes("COMPONENT_SET")) {
          // COMPONENT_SET not allowed, fall through to error handling
        } else {
          const componentSet = node as ComponentSetNode;
          const variant =
            componentSet.defaultVariant || componentSet.children[0];
          if (variant && variant.type === "COMPONENT") {
            cache.set(nodeId, variant as SceneNode);
            return variant as SceneNode;
          }
          // No valid variant found - return null with error
          console.warn(
            `[figdeck] ${errorPrefix} "${nodeId}" is a COMPONENT_SET with no valid variants`,
          );
          failedIds.add(nodeId);
          if (notifyOnError) {
            figma.notify(`${errorPrefix} has no valid variants: ${nodeId}`, {
              error: true,
            });
          }
          return null;
        }
      }

      // Check if node type is allowed (excludes COMPONENT_SET which is handled above)
      if (nodeType !== "COMPONENT_SET" && allowedTypes.includes(nodeType)) {
        cache.set(nodeId, node as SceneNode);
        return node as SceneNode;
      }

      console.warn(
        `[figdeck] ${errorPrefix} "${nodeId}" is type "${node.type}", not supported`,
      );
      failedIds.add(nodeId);
      if (notifyOnError) {
        figma.notify(
          `Cannot use ${errorPrefix.toLowerCase()}: ${nodeId} (${node.type})`,
          {
            error: true,
          },
        );
      }
      return null;
    } catch (e) {
      console.warn(
        `[figdeck] Failed to find ${errorPrefix.toLowerCase()}: ${nodeId}`,
        e,
      );
      failedIds.add(nodeId);
      if (notifyOnError) {
        figma.notify(`${errorPrefix} not found: ${nodeId}`, { error: true });
      }
      return null;
    }
  }

  /**
   * Clear the cache and failed IDs set.
   */
  function clear(): void {
    cache.clear();
    failedIds.clear();
  }

  return { findNode, clear };
}

/**
 * Clone a node appropriately based on its type.
 * Components create instances, others are cloned directly.
 * Returns null if the node reference is stale (e.g., user deleted the node).
 */
export function cloneNode(node: SceneNode): SceneNode | null {
  try {
    if (node.type === "COMPONENT") {
      return (node as ComponentNode).createInstance();
    }
    if (node.type === "COMPONENT_SET") {
      // For component sets, create an instance of the default variant
      const componentSet = node as ComponentSetNode;
      const defaultVariant = componentSet.defaultVariant;
      if (defaultVariant) {
        return defaultVariant.createInstance();
      }
      // Fallback: try the first child if no default variant
      const firstChild = componentSet.children[0];
      if (firstChild && firstChild.type === "COMPONENT") {
        return (firstChild as ComponentNode).createInstance();
      }
      console.warn("[figdeck] Component set has no usable variants");
      return null;
    }
    return node.clone();
  } catch (e) {
    // Node reference is stale - the node was likely deleted by the user
    console.warn("[figdeck] Failed to clone node (may have been deleted):", e);
    return null;
  }
}
