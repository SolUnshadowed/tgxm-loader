import { defineConfig, globalIgnores } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin';
import js from "@eslint/js";
import globals from "globals";

export default defineConfig([
	{
		languageOptions: {
			globals: {
				...globals.browser,
			}
		},
		files: ["**/*.js"],
		plugins: {
			js,
			'@stylistic': stylistic
		},
		extends: ["js/recommended"],
		rules: {
			"no-unused-vars": "warn",
			"no-undef": "warn",
			'@stylistic/brace-style': ["error", "allman"]
		},
	},
    globalIgnores(["./src/misc/*", "./src/assets/*"])
]);
