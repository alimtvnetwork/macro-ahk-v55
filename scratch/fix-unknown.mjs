import fs from 'fs';
const files = [
  'src/components/automation/AutomationView.tsx',
  'src/components/options/api-explorer/ApiExplorerSwagger.tsx',
  'src/components/options/api-explorer/EndpointAccordionItem.tsx',
  'src/components/options/ApiExplorerCard.tsx',
  'src/components/options/data-browser/DataBrowserPanel.tsx',
  'src/components/options/ErrorSwallowAuditView.tsx',
  'src/components/options/project-detail/DocsTab.tsx',
  'src/components/options/recorder/recorder-self-test.ts',
  'src/components/options/recorder/visualisation/use-recorder-step-mutations.ts',
  'src/components/popup/PopupHeader.tsx',
  'src/hooks/use-popup-actions.ts',
  'src/hooks/use-recorder-project-data.ts',
  'src/content-scripts/network-reporter.ts'
];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/} as unknown\)/g, '} as any)');
    c = c.replace(/type: ".*" as unknown/g, match => match.replace('unknown', 'any'));
    c = c.replace(/: unknown;/g, ': any;');
    c = c.replace(/= unknown;/g, '= any;');
    c = c.replace(/<unknown>/g, '<any>');
    c = c.replace(/raw: unknown/g, 'raw: any');
    c = c.replace(/\(unknown\)/g, '(any)');
    c = c.replace(/as unknown/g, 'as any');
    c = c.replace(/no-explicit-unknown/g, 'no-explicit-any');
    // For popup header error where it just changed `any` to `unknown`
    c = c.replace(/type: "GET_PROJECTS" as unknown/, 'type: "GET_PROJECTS" as any');
    c = c.replace(/unknown/g, 'any');
    // fix any 'any' string literals getting caught if there were any, but there shouldn't be
    fs.writeFileSync(f, c);
  }
});
