import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint flat config.
 *
 * A partir de la versión 16, `eslint-config-next` exporta directamente arrays de
 * flat config, así que se importan y se expanden. No se usa `FlatCompat`: el
 * puente de compatibilidad con el formato antiguo revienta contra ESLint 10
 * ("Converting circular structure to JSON") al intentar validar los plugins.
 */
const config = [
  {
    ignores: ["node_modules/**", ".next/**", ".data/**", "samples/**", "next-env.d.ts"],
  },

  ...coreWebVitals,
  ...typescript,

  {
    rules: {
      // Los scripts de CLI y los catch de los endpoints imprimen a consola a
      // propósito: es su interfaz con el usuario.
      "no-console": "off",

      // Marca las variables sin usar salvo que se prefijen con "_", que es la
      // convención al desestructurar descartando campos.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
