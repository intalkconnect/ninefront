import { TextNodeTemplate } from './TextNodeTemplate';
import { MediaNodeTemplate } from './MediaNodeTemplate';
import { LocationNodeTemplate } from './LocationNodeTemplate';
import { CodeNodeTemplate } from './CodeNodeTemplate';
import { HttpNodeTemplate } from './HttpNodeTemplate';
import { HumanNodeTemplate } from './HumanNodeTemplate';
import { DespedidaNodeTemplate } from './DespedidaNodeTemplate';
import { QuickReplyTemplate, MenuListTemplate } from './InteractiveNodeTemplate';

export const nodeTemplates = [
  TextNodeTemplate,
  MediaNodeTemplate,
  QuickReplyTemplate,
  MenuListTemplate,
  LocationNodeTemplate,
  CodeNodeTemplate,
  HttpNodeTemplate,
  HumanNodeTemplate,
  DespedidaNodeTemplate
];
