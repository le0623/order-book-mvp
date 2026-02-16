/**
 * Mapping of Bittensor subnet netuids to their human-readable names.
 * Used in the asset selector dropdown for better UX.
 *
 * Source: https://taostats.io/subnets/
 * This can be updated periodically as new subnets are registered.
 */
export const SUBNET_NAMES: Record<number, string> = {
  0: "Root",
  1: "Apex",
  2: "Omron",
  3: "Templar",
  4: "Targon",
  5: "Kaizen",
  6: "Infinite Games",
  7: "Subvortex",
  8: "Taoshi",
  9: "Pre-Training",
  10: "Sturdy",
  11: "Dippy",
  12: "Horde",
  13: "Dataverse",
  14: "Palaidn",
  15: "De-Val",
  16: "BitAgent",
  17: "Three Gen",
  18: "Cortex.t",
  19: "Namovin",
  20: "BitAds",
  21: "FileTAO",
  22: "Meta Search",
  23: "NicheImage",
  24: "Omega",
  25: "Protein Folding",
  26: "Alchemy",
  27: "Compute",
  28: "Foundry S&P 500",
  29: "Coldint",
  30: "Bettensor",
  31: "NAS Chain",
  32: "It's AI",
  33: "Conversation Genome",
  34: "BitMind",
  35: "LogicNet",
  36: "Human Intelligence",
  37: "Finetuning",
  38: "Tatsu Identity",
  39: "EdgeMaxxing",
  40: "Chunk",
  41: "Sportstensor",
  42: "Masa",
  43: "Graphite",
  44: "Score Vision",
  45: "Gen42",
  46: "Neural Internet",
  47: "Condenses",
  48: "Nextplace",
  49: "Automl",
  50: "Manifold Labs",
  51: "Celium",
  52: "DATURA",
  53: "Agentao",
  56: "Gradients",
  59: "AgentTao",
  61: "Red Team",
  64: "Chutes",
};

/**
 * Returns the subnet name for a given netuid, or undefined if unknown.
 *
 * Args:
 *   netuid (number): The subnet network UID.
 *
 * Returns:
 *   string | undefined: The human-readable subnet name or undefined.
 */
export function getSubnetName(netuid: number): string | undefined {
  return SUBNET_NAMES[netuid];
}

/**
 * Returns a display label for a subnet: "SN{netuid} - {name}" or "SN{netuid}".
 *
 * Args:
 *   netuid (number): The subnet network UID.
 *
 * Returns:
 *   string: Formatted label for display.
 */
export function getSubnetLabel(netuid: number): string {
  const name = SUBNET_NAMES[netuid];
  return name ? `SN${netuid} — ${name}` : `SN${netuid}`;
}
