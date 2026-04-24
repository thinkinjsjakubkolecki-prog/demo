import type { Routes } from '@angular/router';
import { Component, ViewContainerRef, inject, OnInit } from '@angular/core';
import {
  DesignerShellComponent,
  ModelDesignerComponent,
  DatasourceDesignerComponent,
  FormDesignerComponent,
  ProcessDesignerComponent,
  MenuEditorComponent,
  ThemeManagerComponent,
  TranslationManagerComponent,
  ExportPanelComponent,
} from '@echelon-framework/designer-widgets';

@Component({ selector: 'r-pages', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R1 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(DesignerShellComponent as any); } }

@Component({ selector: 'r-models', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R2 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(ModelDesignerComponent as any); } }

@Component({ selector: 'r-ds', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R3 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(DatasourceDesignerComponent as any); } }

@Component({ selector: 'r-forms', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R4 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(FormDesignerComponent as any); } }

@Component({ selector: 'r-proc', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R5 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(ProcessDesignerComponent as any); } }

@Component({ selector: 'r-menu', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R6 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(MenuEditorComponent as any); } }

@Component({ selector: 'r-themes', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R7 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(ThemeManagerComponent as any); } }

@Component({ selector: 'r-i18n', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R8 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(TranslationManagerComponent as any); } }

@Component({ selector: 'r-export', standalone: true, template: '', styles: [':host{display:block;height:100%}'] })
class R9 implements OnInit { private v = inject(ViewContainerRef); ngOnInit() { this.v.createComponent(ExportPanelComponent as any); } }

@Component({ selector: 'r-draft', standalone: true, template: '<p style="padding:40px;color:#9ca3af">Draft preview requires AOT build</p>' })
class R10 {}

export const routes: Routes = [
  { path: '', redirectTo: '/designer', pathMatch: 'full' },
  { path: 'designer', component: R1, title: 'Pages Designer' },
  { path: 'designer/models', component: R2, title: 'Model Designer' },
  { path: 'designer/datasources', component: R3, title: 'Data Sources' },
  { path: 'designer/forms', component: R4, title: 'Forms Designer' },
  { path: 'designer/processes', component: R5, title: 'Process Designer' },
  { path: 'designer/themes', component: R7, title: 'Theme Manager' },
  { path: 'designer/translations', component: R8, title: 'Translations' },
  { path: 'designer/export', component: R9, title: 'Export' },
  { path: 'menu-editor', component: R6, title: 'Menu Editor' },
  { path: 'draft/:id', component: R10 },
  { path: 'embed/:id', component: R10 },
];
