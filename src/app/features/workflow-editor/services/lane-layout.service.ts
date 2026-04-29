import { Injectable } from '@angular/core';
import * as joint from 'jointjs';
import { Lane } from '../../../shared/models/workflow.model';

export interface LaneLayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class LaneLayoutService {
  
  constructor() {}

   /**
   * Posiciona y redimensiona las Calles (lanes).
   * @param fitContent Si es true, ajusta el ancho de la calle para que contenga a sus nodos.
   *                   Si es false (default), divide el paperWidth equitativamente.
   */
  public recalculateLaneLayout(
    graph: joint.dia.Graph,
    lanes: Lane[], 
    paperWidth: number, 
    paperHeight: number,
    fitContent: boolean = false
  ): void {
    console.log('LaneLayoutService.recalculateLaneLayout - starting lane layout', {
      laneCount: lanes?.length || 0,
      paperWidth,
      paperHeight,
      fitContent
    });

    const validLanes = Array.isArray(lanes) ? lanes.filter(l => l && l.id) : [];
    const laneCount = validLanes.length;

    if (laneCount === 0) {
      console.warn('LaneLayoutService.recalculateLaneLayout - no valid lanes to layout');
      return;
    }

    // 1. Calcular la altura mínima necesaria basada en los nodos
    let maxNodeY = paperHeight;
    graph.getElements().forEach(el => {
      if (el.get('type') !== 'app.Lane') {
        const bbox = el.getBBox();
        const bottom = bbox.y + bbox.height + 100;
        if (bottom > maxNodeY) maxNodeY = bottom;
      }
    });
    const calculatedHeight = maxNodeY;

    // 2. Ordenar lanes
    const sortedLanes = [...validLanes]
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    // 3. Calcular geometría
    let currentX = 0;
    const defaultWidth = paperWidth / laneCount;

    sortedLanes.forEach((laneModel) => {
      let width = defaultWidth;
      
      if (fitContent) {
        // Encontrar el nodo más a la derecha de esta calle para determinar el ancho
        let maxRight = 150; // Ancho mínimo inicial
        graph.getElements().forEach(el => {
          if (el.get('type') !== 'app.Lane' && el.get('parent') === laneModel.id) {
             const bbox = el.getBBox();
             // La posición es absoluta, así que el ancho necesario es (MaxX + AnchoNodo) - InicioCalle
             const nodeRight = bbox.x + bbox.width + 40; 
             if (nodeRight > maxRight) maxRight = nodeRight;
          }
        });
        
        // El ancho de la calle debe ser al menos lo necesario para cubrir sus nodos
        // Pero como los nodos tienen posiciones absolutas, si un nodo está en x=600 y la calle empieza en x=0, el ancho debe ser 600.
        // Si la calle empieza en currentX, y el nodo está en x=600, el ancho debe ser 600 - currentX.
        width = Math.max(defaultWidth, maxRight - currentX);
      }

      const visualLane = graph.getCell(laneModel.id) as joint.dia.Element;
      if (visualLane && visualLane.get('type') === 'app.Lane') {
        visualLane.position(currentX, 0);
        visualLane.resize(width, calculatedHeight);
        console.log(`LaneLayoutService - Lane ${laneModel.nombre} set to x:${currentX}, w:${width}`);
      }

      currentX += width;
    });

    console.log('LaneLayoutService.recalculateLaneLayout - completed', { totalWidth: currentX });
  }

}
