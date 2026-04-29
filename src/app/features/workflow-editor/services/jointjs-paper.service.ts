import { Injectable, NgZone } from '@angular/core';
import * as joint from 'jointjs';

export interface PaperSetupOptions {
  containerId: HTMLElement;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class JointjsPaperService {
  
  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;

  constructor(private ngZone: NgZone) {}

  /**
   * Inicializa el Grafo y el Paper dentro del contenedor proporcionado,
   * inyectando las reglas estrictas de Workflow (Swimlanes / Nodes).
   */
  public initializePaper(options: PaperSetupOptions): { graph: joint.dia.Graph, paper: joint.dia.Paper } {
    this.graph = new joint.dia.Graph({}, { cellNamespace: joint.shapes });

    this.ngZone.runOutsideAngular(() => {
      this.paper = new joint.dia.Paper({
        el: options.containerId,
        model: this.graph,
        width: options.width,
        height: options.height,
        background: { color: '#f1f5f9' },
        gridSize: 10,
        drawGrid: true,
        
        // --- Embedding Configuration ---
        embeddingMode: true,
        frontParentOnly: false,

        /**
         * Validar qué elementos pueden incrustarse dentro de otros.
         * Reglas:
         * 1. Lane puede contener Nodes.
         * 2. Lane NO puede contener otro Lane.
         * 3. Nodes NO pueden contener Nodes.
         * 4. Enlaces (Links) NO se embeben.
         */
        validateEmbedding: (childView, parentView) => {
          const childModel = childView.model;
          const parentModel = parentView.model;

          if (childModel.isLink()) {
            return false;
          }

          const childType = childModel.get('type');
          const parentType = parentModel.get('type');

          if (parentType === 'app.Lane') {
            return childType !== 'app.Lane'; // Lane no entra en Lane, pero sí cualquier otro nodo
          }

          return false; // Por defecto rechazar embebido
        },

        /**
         * Restringir el movimiento de un Nodo para que nunca pueda salirse
         * de los límites de su elemento Padre (la Calle).
         */
        restrictTranslate: ((elementView: joint.dia.ElementView) => {
          const childModel = elementView.model;
          const parentId = childModel.get('parent');
          
          if (!parentId) {
            // Si no tiene padre (ej. es una Calle o está en el limbo), no aplicar restricción
            return false;
          }
          
          const parentModel = this.graph.getCell(parentId) as joint.dia.Element;
          
          if (parentModel && parentModel.get('type') === 'app.Lane') {
             // Área permitida reduciendo el BBox padre por padding interno
             const parentBBox = parentModel.getBBox();
             const PADDING = 16;
             const HEADER_HEIGHT = 40;

             return new joint.g.Rect(
               parentBBox.x + PADDING,
               parentBBox.y + HEADER_HEIGHT + PADDING,
               parentBBox.width - (PADDING * 2),
               parentBBox.height - HEADER_HEIGHT - (PADDING * 2)
             );
          }

          return false;
        }) as any,

        interactive: ((cellView: joint.dia.CellView) => {
          const cellType = cellView.model.get('type');

          // Las calles son estructurales: no deben moverse manualmente.
          if (cellType === 'app.Lane') {
            return {
              elementMove: false,
              addLinkFromMagnet: false,
              vertexAdd: false,
              vertexMove: false,
              arrowheadMove: false,
              useLinkTools: false
            };
          }

          return true;
        }) as joint.dia.Paper.Options['interactive']
      });
    });

    return { graph: this.graph, paper: this.paper };
  }

  public getGraph(): joint.dia.Graph | undefined {
    return this.graph;
  }

  public getPaper(): joint.dia.Paper | undefined {
    return this.paper;
  }

  public destroy(): void {
    if (this.paper) {
      this.paper.remove();
    }
  }
}
