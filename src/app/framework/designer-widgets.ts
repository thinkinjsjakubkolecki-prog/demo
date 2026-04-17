/**
 * Proxy barrel — re-export z lokalnych kopii.
 * Docelowo: import z @echelon-framework/designer-widgets (po publish rc.17).
 */
export { ModelDesignerComponent } from './model-designer.component';
export { FormDesignerComponent } from './form-designer.component';
export { DatasourceDesignerComponent } from './datasource-designer.component';
export { ProcessDesignerComponent } from './process-designer.component';
export { MenuEditorComponent } from './menu-editor.component';
export { DesignerShellComponent } from './designer-shell.component';
export { FormRefComponent } from './form-ref.component';
export { AdvancedFormComponent } from './advanced-form.component';
export { ContainerComponent } from './container.component';

export { ModelDesignerPage } from './model-designer.page';
export { FormsDesignerPage } from './forms-designer.page';
export { DatasourcesDesignerPage } from './datasources-designer.page';
export { ProcessDesignerPage } from './process-designer.page';
export { DesignerPage } from './designer.page';
export { MenuEditorPage } from './menu-editor.page';

export { ExportPanelComponent } from './export-panel.component';
export { ExportPage } from './export.page';
export { designerWidgets, designerPages, designerMenuItems } from './designer-api';
export { exportBundle, exportBundleAsJson, exportBundleAsTypeScript, type ExportBundle } from './export-bundle';
