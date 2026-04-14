import echelon from '@echelon-framework/eslint-plugin';

export default [
  echelon.configs.recommended,
  {
    files: ['src/app/widgets/**/*.ts'],
    ...echelon.configs['widget-strict'],
  },
];
