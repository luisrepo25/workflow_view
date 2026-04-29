import * as joint from 'jointjs';

export const WORKFLOW_COLORS = {
  laneBackgrounds: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8'],
  laneStroke: '#cbd5e1',
  laneHeader: '#e2e8f0',
  laneHeaderText: '#334155',
  nodeStroke: '#6366f1',
  nodeFill: '#ffffff',
  nodeText: '#1e293b',
  linkStroke: '#94a3b8',
};

// ── LANE DEFINITION ──────────────────────────────────────────────────────────

export class AppLane extends joint.dia.Element {
  override defaults() {
    return joint.util.deepSupplement({
      type: 'app.Lane',
      attrs: {
        body: {
          refWidth: '100%',
          refHeight: '100%',
          fill: '#f8fafc',
          stroke: '#cbd5e1',
          strokeWidth: 1,
        },
        header: {
          refWidth: '100%',
          height: 40,
          fill: '#e2e8f0',
          stroke: '#cbd5e1',
          strokeWidth: 1,
          refX: 0,
          refY: 0,
        },
        label: {
          textVerticalAnchor: 'middle',
          textAnchor: 'middle',
          refX: '50%',
          refY: 20, // mitad del header
          fontSize: 14,
          fontWeight: 'bold',
          fill: '#334155',
          fontFamily: 'Inter, sans-serif',
          text: 'Nueva Calle'
        }
      },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'header' },
        { tagName: 'text', selector: 'label' }
      ]
    }, joint.dia.Element.prototype.defaults);
  }
}

// Registrar en el namespace de JointJS para fromJSON/toJSON automático
Object.assign(joint.shapes, {
  app: {
    Lane: AppLane
  }
});
