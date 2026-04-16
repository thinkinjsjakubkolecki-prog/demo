/**
 * Business process — swim-lane model mapowany 1:1 na kod Echelon/Angular.
 *
 * Używany przez `fx-business-flow` widget do renderowania BPMN-like
 * diagramów z linkowaniem do realnych widgetów/handlerów/computed funkcji.
 */

export type LaneId = 'client' | 'dealer' | 'system' | 'compliance' | 'backoffice';

export type StepKind = 'start' | 'end' | 'task' | 'gateway' | 'event' | 'script';

export type StepStatus = 'implemented' | 'partial' | 'todo';

export interface ProcessStep {
  readonly id: string;
  readonly lane: LaneId;
  readonly label: string;
  readonly description: string;
  readonly kind?: StepKind;
  readonly status: StepStatus;
  /** Mapowanie na realne artefakty w kodzie. */
  readonly impl: {
    readonly page?: string;
    readonly route?: string;
    readonly widget?: string;
    readonly event?: string;
    readonly handler?: string;
    readonly datasource?: string;
    readonly computed?: string;
    readonly file?: string;
    readonly note?: string;
  };
  /** Co user powinien zrobić w GUI żeby zobaczyć ten krok. */
  readonly howToSee?: string;
}

export interface ProcessEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface Lane {
  readonly id: LaneId;
  readonly label: string;
  readonly color: string;
}

export interface BusinessProcess {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly lanes: ReadonlyArray<Lane>;
  readonly steps: ReadonlyArray<ProcessStep>;
  readonly edges: ReadonlyArray<ProcessEdge>;
  /** Ścieżka do strony której dotyczy proces — przycisk "Otwórz w GUI". */
  readonly entryRoute?: string;
}
