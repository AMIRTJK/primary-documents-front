export const EQueryKeys = {
  USER: "USER",
} as const;

export type TEQueryKeys = (typeof EQueryKeys)[keyof typeof EQueryKeys];
