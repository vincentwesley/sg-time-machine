import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "site/dist", "site/public", "site/js", "site/credits", "data", "qa-output", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
