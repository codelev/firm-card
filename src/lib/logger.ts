type Level = "info" | "warn" | "error";

type Fields = Record<string, string | number | boolean | undefined>;

function write(level: Level, message: string, fields: Fields = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

export function errorFields(error: unknown): Fields {
  return error instanceof Error ? { error: error.name, detail: error.message } : { error: String(error) };
}
