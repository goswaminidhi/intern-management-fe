export const PASSWORD_RULES = [
  {
    id: "length",
    label: "8 to 72 characters",
    test: (val) => Boolean(val && val.length >= 8 && val.length <= 72),
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter (A–Z)",
    test: (val) => /[A-Z]/.test(val || ""),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter (a–z)",
    test: (val) => /[a-z]/.test(val || ""),
  },
  {
    id: "number",
    label: "At least one number (0–9)",
    test: (val) => /[0-9]/.test(val || ""),
  },
  {
    id: "special",
    label: "At least one special character (!@#$%...)",
    test: (val) => /[!@#$%^&*(),.?":{}|<>_-]/.test(val || ""),
  },
];

export const checkPasswordRules = (pwd) => {
  return PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(pwd || ""),
  }));
};

export const getPasswordStrength = (passedCount, hasPassword) => {
  if (!hasPassword) return null;
  if (passedCount <= 2) {
    return {
      label: "Weak",
      color: "bg-rose-500",
      text: "text-rose-500 dark:text-rose-400",
      percent: "w-1/4",
    };
  }
  if (passedCount === 3) {
    return {
      label: "Fair",
      color: "bg-amber-500",
      text: "text-amber-500 dark:text-amber-400",
      percent: "w-2/4",
    };
  }
  if (passedCount === 4) {
    return {
      label: "Good",
      color: "bg-blue-500",
      text: "text-blue-500 dark:text-blue-400",
      percent: "w-3/4",
    };
  }
  return {
    label: "Strong",
    color: "bg-emerald-500",
    text: "text-emerald-500 dark:text-emerald-400",
    percent: "w-full",
  };
};
