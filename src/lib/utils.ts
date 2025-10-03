type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | undefined | null };

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const process = (value: ClassValue) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(process);
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, val]) => {
        if (val) classes.push(key);
      });
    }
  };

  inputs.forEach(process);

  return classes.join(" ");
}
