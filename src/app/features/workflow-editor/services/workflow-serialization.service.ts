import { Injectable } from '@angular/core';
import * as joint from 'jointjs';
import { AppLane } from '../utils/workflow-editor.constants';
import { Workflow, Lane, WorkflowNode, WorkflowEdge } from '../../../shared/models/workflow.model';

@Injectable({
  providedIn: 'root'
})
export class WorkflowSerializationService {

  constructor() { }

  /**
   * Lee la definición del backend y la inserta explícitamente en el grafo
   * como celdas de negocio: app.Lane, estándar Node/Edge.
   */
  public fromBackendWorkflow(graph: joint.dia.Graph, workflow: Workflow): void {
    console.log('WorkflowSerializationService.fromBackendWorkflow - starting deserialization', {
      workflowId: workflow?.id,
      laneCount: workflow?.lanes?.length || 0,
      nodeCount: workflow?.nodes?.length || 0,
      edgeCount: workflow?.edges?.length || 0
    });

    // 1. Limpiar canvas previo
    graph.clear();

    const cells: joint.dia.Cell[] = [];

    // 2. Validar que el workflow tenga datos básicos
    if (!workflow) {
      console.error('WorkflowSerializationService.fromBackendWorkflow - workflow is null or undefined');
      graph.addCells(cells);
      return;
    }

    // 3. Mapear Lanes (solo registro, LayoutService hará la geometría de x/y width/height después)
    // El orden y geometría real la calcula LaneLayoutService
    const laneMap = new Map<string, joint.dia.Element>();
    const lanes = Array.isArray(workflow.lanes) ? workflow.lanes : [];
    
    lanes.forEach(laneDto => {
      if (!laneDto || !laneDto.id) {
        console.warn('WorkflowSerializationService.fromBackendWorkflow - invalid lane DTO, skipping', laneDto);
        return;
      }

      try {
        const laneEl = new AppLane({
          id: laneDto.id,
          attrs: {
            label: { text: laneDto.nombre || 'Calle Sin Nombre' }
          },
          // info metadata
          originalData: { ...laneDto }
        });
        
        cells.push(laneEl);
        laneMap.set(laneDto.id, laneEl);
        console.log('WorkflowSerializationService.fromBackendWorkflow - lane created', { id: laneDto.id, nombre: laneDto.nombre });
      } catch (error) {
        console.error('WorkflowSerializationService.fromBackendWorkflow - error creating lane', { laneDto, error });
      }
    });

    // 4. Mapear Nodes y Embeber
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const createdNodeIds = new Set<string>();

    nodes.forEach(nodeDto => {
      if (!nodeDto || !nodeDto.id || !nodeDto.tipo) {
        console.warn('WorkflowSerializationService.fromBackendWorkflow - invalid node DTO, skipping', nodeDto);
        return;
      }

      // Validar que la lane referenciada existe
      if (!nodeDto.laneId || !laneMap.has(nodeDto.laneId)) {
        console.warn('WorkflowSerializationService.fromBackendWorkflow - node references non-existent lane, skipping', {
          nodeId: nodeDto.id,
          referencedLaneId: nodeDto.laneId,
          availableLanes: Array.from(laneMap.keys())
        });
        return;
      }

      try {
        // Fallback genérico a JointJS standard si no hay shape custom
        // Por simplicidad en MVP se usan shapes estándares para Activities y otros,
        // o idealmente shapes custom importados en constants.
        
        const isDecision = nodeDto.tipo === 'decision';
        const isInicio = nodeDto.tipo === 'inicio';
        const isFin = nodeDto.tipo === 'fin';
        // Usar posiciones persistidas del backend
        const x = Number(nodeDto.posicionX ?? nodeDto.x) || 0;
        const y = Number(nodeDto.posicionY ?? nodeDto.y) || 0;
        const ancho = Number(nodeDto.ancho) || (isDecision ? 80 : (isInicio || isFin ? 40 : 150));
        const alto = Number(nodeDto.alto) || (isDecision ? 80 : (isInicio || isFin ? 40 : 60));
        
        let nodeEl: joint.dia.Element;
        
        if (isDecision) {
          nodeEl = new joint.shapes.standard.Polygon({
            id: nodeDto.id,
            position: { x, y },
            size: { width: ancho, height: alto },
            attrs: {
              body: { refPoints: '0,10 10,0 20,10 10,20', fill: '#fef08a', stroke: '#ca8a04' },
              label: { text: nodeDto.nombre || 'Decision', fill: '#854d0e', fontSize: 12 }
            },
            originalData: { ...nodeDto }
          });
        } else if (isInicio) {
          nodeEl = new joint.shapes.standard.Circle({
            id: nodeDto.id,
            position: { x, y },
            size: { width: ancho, height: alto },
            attrs: {
              body: { fill: '#000000', stroke: 'none' },
              label: { text: nodeDto.nombre || 'Inicio', fill: '#1e293b', fontSize: 12, refY: '100%', refY2: 10 }
            },
            originalData: { ...nodeDto }
          });
        } else if (isFin) {
          nodeEl = new joint.shapes.standard.Circle({
            id: nodeDto.id,
            position: { x, y },
            size: { width: ancho, height: alto },
            markup: [
               { tagName: 'circle', selector: 'outerRing' },
               { tagName: 'circle', selector: 'body' },
               { tagName: 'text', selector: 'label' }
            ],
            attrs: {
               outerRing: { cx: 'calc(0.5*w)', cy: 'calc(0.5*h)', r: 'calc(0.5*w)', fill: 'none', stroke: '#000000', strokeWidth: 3 },
               body: { cx: 'calc(0.5*w)', cy: 'calc(0.5*h)', r: 'calc(0.5*w - 5)', fill: '#000000', stroke: 'none' },
               label: { text: nodeDto.nombre || 'Fin', fill: '#1e293b', fontSize: 12, refY: '100%', refY2: 10 }
            },
            originalData: { ...nodeDto }
          });
        } else {
          nodeEl = new joint.shapes.standard.Rectangle({
            id: nodeDto.id,
            position: { x, y },
            size: { width: ancho, height: alto },
            attrs: {
              body: { rx: 8, ry: 8, fill: '#ffffff', stroke: '#6366f1', strokeWidth: 2 },
              label: { text: nodeDto.nombre || 'Nodo', fill: '#1e293b', fontSize: 12 }
            },
            originalData: { ...nodeDto }
          });
        }

        cells.push(nodeEl);
        createdNodeIds.add(nodeDto.id);
        
        // Embeber en el lane padre
        const parentLane = laneMap.get(nodeDto.laneId);
        if (parentLane) {
          parentLane.embed(nodeEl);
        }
        
        console.log('WorkflowSerializationService.fromBackendWorkflow - node created', {
          nodeId: nodeDto.id,
          tipo: nodeDto.tipo,
          laneId: nodeDto.laneId,
          posicionX: x,
          posicionY: y
        });
      } catch (error) {
        console.error('WorkflowSerializationService.fromBackendWorkflow - error creating node', { nodeDto, error });
      }
    });

    // 5. Mapear Links (Edges)
    const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
    
    // -- Lógica para Barras de Sincronización (Fork/Join) UML 2.5 --
    const outDegree = new Map<string, any[]>();
    const inDegree = new Map<string, any[]>();

    edges.forEach((edgeDto, index) => {
      const fromNodeId = String(edgeDto.fromNodeId ?? (edgeDto as any).origen);
      const toNodeId = String(edgeDto.toNodeId ?? (edgeDto as any).destino);
      if (!outDegree.has(fromNodeId)) outDegree.set(fromNodeId, []);
      outDegree.get(fromNodeId)!.push(edgeDto);
      if (!inDegree.has(toNodeId)) inDegree.set(toNodeId, []);
      inDegree.get(toNodeId)!.push(edgeDto);
    });

    const edgeSourceOverrides = new Map<string, any>();
    const edgeTargetOverrides = new Map<string, any>();

    nodes.forEach(nodeDto => {
      if (nodeDto.tipo === 'actividad') {
        const outs = outDegree.get(String(nodeDto.id)) || [];
        if (outs.length >= 2) {
          const alto = Number(nodeDto.alto) || 60;
          const syncBarId = `sync_out_${nodeDto.id}`;
          const syncBar = new joint.shapes.standard.Rectangle({
            id: syncBarId,
            position: { x: (Number(nodeDto.posicionX) || 0) + 25, y: (Number(nodeDto.posicionY) || 0) + alto + 40 },
            size: { width: 100, height: 6 },
            attrs: { body: { fill: '#1e293b', stroke: '#1e293b', rx: 3, ry: 3 } }
          });
          syncBar.set('isVirtualSyncBar', true);
          syncBar.set('originalSourceId', String(nodeDto.id));
          cells.push(syncBar);
          
          const parentLane = laneMap.get(nodeDto.laneId!);
          if (parentLane) parentLane.embed(syncBar);

          const vLink = new joint.shapes.standard.Link({
             id: `v-link-out-${nodeDto.id}`,
             source: { id: String(nodeDto.id), anchor: { name: 'bottom' }, connectionPoint: { name: 'anchor' } },
             target: { id: syncBarId, anchor: { name: 'top' }, connectionPoint: { name: 'anchor' } },
             attrs: { line: { stroke: '#1e293b', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } } },
             connector: { name: 'rounded' } // No router, straight line
          });
          vLink.set('isVirtualLink', true);
          cells.push(vLink);

          outs.forEach((e, i) => {
             const fromNodeId = e.fromNodeId ?? (e as any).origen;
             const toNodeId = e.toNodeId ?? (e as any).destino;
             const eId = String(e.id || this.buildEdgeId(fromNodeId, toNodeId, i));
             // Spread out the starting points to avoid overlap
             const dx = outs.length > 1 ? -30 + (60 * i / (outs.length - 1)) : 0;
             edgeSourceOverrides.set(eId, { 
                id: syncBarId, 
                anchor: { name: 'modelCenter', args: { dx: dx, dy: 3 } }, 
                connectionPoint: { name: 'anchor' } 
             });
          });
        }

        const ins = inDegree.get(String(nodeDto.id)) || [];
        if (ins.length >= 2) {
          const syncBarId = `sync_in_${nodeDto.id}`;
          const syncBar = new joint.shapes.standard.Rectangle({
            id: syncBarId,
            position: { x: (Number(nodeDto.posicionX) || 0) + 25, y: (Number(nodeDto.posicionY) || 0) - 40 },
            size: { width: 100, height: 6 },
            attrs: { body: { fill: '#1e293b', stroke: '#1e293b', rx: 3, ry: 3 } }
          });
          syncBar.set('isVirtualSyncBar', true);
          syncBar.set('originalTargetId', String(nodeDto.id));
          cells.push(syncBar);
          
          const parentLane = laneMap.get(nodeDto.laneId!);
          if (parentLane) parentLane.embed(syncBar);

          const vLink = new joint.shapes.standard.Link({
             id: `v-link-in-${nodeDto.id}`,
             source: { id: syncBarId, anchor: { name: 'bottom' }, connectionPoint: { name: 'anchor' } },
             target: { id: String(nodeDto.id), anchor: { name: 'top' }, connectionPoint: { name: 'anchor' } },
             attrs: { line: { stroke: '#1e293b', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } } },
             connector: { name: 'rounded' } // No router, straight line
          });
          vLink.set('isVirtualLink', true);
          cells.push(vLink);

          ins.forEach((e, i) => {
             const fromNodeId = e.fromNodeId ?? (e as any).origen;
             const toNodeId = e.toNodeId ?? (e as any).destino;
             const eId = String(e.id || this.buildEdgeId(fromNodeId, toNodeId, i));
             // Spread out the ending points to avoid overlap
             const dx = ins.length > 1 ? -30 + (60 * i / (ins.length - 1)) : 0;
             edgeTargetOverrides.set(eId, { 
                id: syncBarId, 
                anchor: { name: 'modelCenter', args: { dx: dx, dy: -3 } }, 
                connectionPoint: { name: 'anchor' } 
             });
          });
        }
      }
    });
    // -- Fin Lógica Barras de Sincronización --
    
    edges.forEach((edgeDto, index) => {
      if (!edgeDto) {
        console.warn('WorkflowSerializationService.fromBackendWorkflow - invalid edge DTO, skipping', edgeDto);
        return;
      }

      const fromNodeId = edgeDto.fromNodeId ?? (edgeDto as any).origen;
      const toNodeId = edgeDto.toNodeId ?? (edgeDto as any).destino;
      const label = edgeDto.label ?? (edgeDto as any).etiqueta;
      const edgeId = edgeDto.id || this.buildEdgeId(fromNodeId, toNodeId, index);

      if (!fromNodeId || !toNodeId) {
        console.warn('WorkflowSerializationService.fromBackendWorkflow - edge missing node references, skipping', {
          edgeId,
          fromNodeId,
          toNodeId
        });
        return;
      }

      // Validar que ambos nodos existan
      if (!createdNodeIds.has(String(fromNodeId)) || !createdNodeIds.has(String(toNodeId))) {
        console.warn('WorkflowSerializationService.fromBackendWorkflow - edge references non-existent nodes, skipping', {
          edgeId,
          fromNodeId,
          toNodeId,
          availableNodes: Array.from(createdNodeIds)
        });
        return;
      }

      try {
        const sourceObj = edgeSourceOverrides.get(edgeId) || { id: String(fromNodeId), anchor: { name: 'bottom' }, connectionPoint: { name: 'boundary' } };
        const targetObj = edgeTargetOverrides.get(edgeId) || { id: String(toNodeId), anchor: { name: 'top' }, connectionPoint: { name: 'boundary' } };

        const link = new joint.shapes.standard.Link({
          id: edgeId,
          source: sourceObj,
          target: targetObj,
          labels: label ? [{ attrs: { text: { text: String(label) } } }] : [],
          attrs: {
            line: { stroke: '#94a3b8', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } }
          },
          router: { name: 'manhattan', args: { startDirections: ['bottom'], endDirections: ['top'], step: 10, padding: 15 } },
          connector: { name: 'rounded' },
          originalData: { ...edgeDto }
        });
        
        cells.push(link);
        console.log('WorkflowSerializationService.fromBackendWorkflow - edge created', {
          edgeId,
          fromNodeId,
          toNodeId
        });
      } catch (error) {
        console.error('WorkflowSerializationService.fromBackendWorkflow - error creating edge', { edgeDto, error });
      }
    });

    // 6. Inyectar todo al Graph
    try {
      graph.addCells(cells);
      console.log('WorkflowSerializationService.fromBackendWorkflow - workflow deserialized successfully', {
        lanesCreated: laneMap.size,
        nodesCreated: createdNodeIds.size,
        edgesCreated: edges.length
      });
    } catch (error) {
      console.error('WorkflowSerializationService.fromBackendWorkflow - error adding cells to graph', error);
    }
  }

  private buildEdgeId(fromNodeId: unknown, toNodeId: unknown, index: number): string {
    const from = String(fromNodeId ?? 'from').replace(/[^a-zA-Z0-9_-]/g, '_');
    const to = String(toNodeId ?? 'to').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `e-${from}-${to}-${index}`;
  }

  /**
   * Extrae el estado actual del diagramador JointJS y retorna el payload crudo
   * listo para ser enviado a Spring Boot.
   */
  public toBackendWorkflow(graph: joint.dia.Graph, sourceDto: Workflow): Workflow {
    // Clon superficial del DTO original
    const result: Workflow = { ...sourceDto, lanes: [], nodes: [], edges: [] };
    const sourceLaneMap = new Map((sourceDto.lanes || []).map(lane => [String(lane.id), lane]));
    const sourceNodeMap = new Map((sourceDto.nodes || []).map(node => [String(node.id), node]));
    const sourceEdgeMap = new Map((sourceDto.edges || []).map(edge => [String(edge.id || ''), edge]));
    const laneDepartmentMap = new Map<string, string>();

    const cells = graph.getCells();

    cells.forEach(cell => {
      // Ignorar nodos y enlaces virtuales de sincronización para que no se guarden en backend
      if (cell.get('isVirtualSyncBar') || cell.get('isVirtualLink')) {
        return;
      }

      // Si es un Lane
      if (cell.get('type') === 'app.Lane') {
        const sourceLane = sourceLaneMap.get(String(cell.id));
        const originalLane: Lane = cell.get('originalData') || {};
        const laneId = String(cell.id);
        const normalizedLaneDepartmentId = this.normalizeObjectId(
          sourceLane?.departmentId ?? originalLane.departmentId
        );

        result.lanes.push({
          ...(sourceLane || {}),
          ...originalLane,
          id: laneId,
          nombre: cell.attr('label/text') || sourceLane?.nombre || originalLane.nombre,
          departmentId: normalizedLaneDepartmentId,
        });

        if (normalizedLaneDepartmentId) {
          laneDepartmentMap.set(laneId, normalizedLaneDepartmentId);
        }
      } 
      // Si es un nodo
      else if (cell.isElement() && cell.get('type') !== 'app.Lane') {
        const parentId = cell.get('parent');
        const sourceNode = sourceNodeMap.get(String(cell.id));
        const originalNode: WorkflowNode = cell.get('originalData') || {};
        const bbox = cell.getBBox();
        const laneId = String(parentId ?? '');
        
        // PRIORIDAD: 
        // 1. El departmentId de la calle (lane) en la que está embebido
        // 2. El departmentId que ya tenía el nodo
        const laneDepartmentId = laneDepartmentMap.get(laneId);
        const nodeDepartmentId = this.normalizeObjectId(sourceNode?.departmentId ?? originalNode.departmentId);
        const finalDepartmentId = laneDepartmentId || nodeDepartmentId;

        result.nodes.push({
          ...(sourceNode || {}),
          ...originalNode,
          id: String(cell.id),
          laneId, // Referencia explícita inferida en frontend
          departmentId: finalDepartmentId || undefined,
          nombre: cell.attr('label/text') || sourceNode?.nombre || originalNode.nombre,
          posicionX: Math.round(bbox.x),
          posicionY: Math.round(bbox.y),
          ancho: Math.round(bbox.width),
          alto: Math.round(bbox.height),
        });
      } 
      // Si es Link (Edge)
      else if (cell.isLink()) {
        const sourceEdge = sourceEdgeMap.get(String(cell.id));
        const originalEdge: WorkflowEdge = cell.get('originalData') || {};
        const source = cell.get('source');
        const target = cell.get('target');
        
        // Evitamos enviar edges "incompletos" conectando a ninguna parte
        if (source?.id && target?.id) {
          let finalFromNodeId = String(source.id);
          let finalToNodeId = String(target.id);
          
          // Reconstruir origen si provenía de barra de sincronización
          const sourceCell = graph.getCell(finalFromNodeId);
          if (sourceCell && sourceCell.get('isVirtualSyncBar')) {
            finalFromNodeId = sourceCell.get('originalSourceId') || finalFromNodeId;
          }

          // Reconstruir destino si iba hacia barra de sincronización
          const targetCell = graph.getCell(finalToNodeId);
          if (targetCell && targetCell.get('isVirtualSyncBar')) {
            finalToNodeId = targetCell.get('originalTargetId') || finalToNodeId;
          }

          result.edges.push({
            ...(sourceEdge || {}),
            ...originalEdge,
            id: String(cell.id),
            fromNodeId: finalFromNodeId,
            toNodeId: finalToNodeId
          });
        }
      }
    });

    // Post-procesamiento de seguridad: Asegurar que NINGÚN nodo se quede sin departmentId si su lane lo tiene
    result.nodes = result.nodes.map(node => {
        if (!node.departmentId && node.laneId) {
            const laneDept = laneDepartmentMap.get(node.laneId);
            if (laneDept) {
                return { ...node, departmentId: laneDept };
            }
        }
        return node;
    });

    return result;
  }

  private normalizeObjectId(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const objectIdMatch = trimmed.match(/^ObjectId\((['"]?)(.+?)\1\)$/i);
      if (objectIdMatch?.[2]) {
        return objectIdMatch[2].trim();
      }

      const wrappedQuotesMatch = trimmed.match(/^['"](.+)['"]$/);
      if (wrappedQuotesMatch?.[1]) {
        return wrappedQuotesMatch[1].trim();
      }

      return trimmed;
    }

    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      const candidate = objectValue['$oid'] ?? objectValue['oid'] ?? objectValue['id'] ?? objectValue['value'];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    const normalized = String(value).trim();
    return normalized === '[object Object]' ? '' : normalized;
  }
}
