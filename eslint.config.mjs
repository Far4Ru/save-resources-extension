import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        rules: {
            "quotes": ["error", "double"],
            "semi": ["error", "always"],
            "spaced-comment": ["error", "always", { "exceptions": ["-", "+"] }],
            "no-dupe-else-if": "error",
            "no-import-assign": "error",
            "no-promise-executor-return": "error",
            "no-setter-return": "error",
            "no-unreachable-loop": "error",
            "accessor-pairs": "warn",
            "default-case-last": "error",
            "default-param-last": "warn",
            "dot-notation": "error",
            "eqeqeq": ["error", "smart"],
            "grouped-accessor-pairs": "warn",
            "curly": ["error", "all"],
            "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: true }],
            "indent": ["error", 4],
            "quote-props": ["error", "consistent"],
            "no-tabs": "error",
            "no-multi-spaces": ["error"],
            "comma-dangle": ["error", "always-multiline"],
            "eol-last": "warn",
            "padded-blocks": ["warn", "never"],
        },
    },
]);
