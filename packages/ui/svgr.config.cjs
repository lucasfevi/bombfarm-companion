module.exports = {
  typescript: true,
  jsxRuntime: 'automatic',
  dimensions: false,
  expandProps: 'end',
  index: false,
  filenameCase: 'kebab',
  prettier: true,
  svgo: true,
  svgoConfig: {
    plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }],
  },
  template: (variables, { tpl }) => tpl`
${variables.imports};

${variables.interfaces};

const ${variables.componentName} = (${variables.props}) => (
  ${variables.jsx}
);

${variables.exports};
`,
};
