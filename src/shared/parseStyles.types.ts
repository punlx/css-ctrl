// src/shared/parseStyles.types.ts
export interface IQueryBlock {
  selector: string;
  styleDef: IStyleDefinition;
}

export interface IStyleDefinition {
  base: Record<string, string>;
  states: Record<string, Record<string, string>>;
  screens: Array<{
    query: string;
    props: Record<string, string>;
  }>;
  containers: Array<{
    query: string;
    props: Record<string, string>;
  }>;
  pseudos: {
    [key: string]: Record<string, string> | undefined;
  };
  varStates?: {
    [stateName: string]: Record<string, string>;
  };
  varBase?: Record<string, string>;
  varPseudos?: {
    [key: string]: Record<string, string>;
  };
  rootVars?: Record<string, string>;
  localVars?: Record<string, string>;

  /**
   * ฟิลด์ใหม่สำหรับ nested query
   */
  queries?: IQueryBlock[];
  hasRuntimeVar?: boolean;
}
