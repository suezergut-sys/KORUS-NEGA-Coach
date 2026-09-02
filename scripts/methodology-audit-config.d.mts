export type AuditedMethodologyKind = "principle" | "case_rule" | "stratagem" | "anti_pattern" | "example" | "evaluation_criterion";

export type MethodologyAuditConfig = {
  releaseVersion: string;
  expectedAtoms: number;
  expectedKinds: Record<AuditedMethodologyKind, number>;
  corrections: Record<string, readonly [AuditedMethodologyKind, AuditedMethodologyKind]>;
};

export const METHODOLOGY_AUDIT: Record<"SRC-001" | "SRC-002" | "SRC-003", MethodologyAuditConfig>;
export const METHODOLOGY_KIND_DEFINITIONS: Record<AuditedMethodologyKind, string>;
