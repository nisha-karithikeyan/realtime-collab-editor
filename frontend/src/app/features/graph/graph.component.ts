import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as d3 from 'd3';
import { firstValueFrom } from 'rxjs';
import { DocumentsApiService } from '../../core/documents/services/documents-api.service';
import { GraphEdge, GraphNode } from '../../core/documents/models';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {}

const TAG_COLOR_SCALE = d3.scaleOrdinal(d3.schemeTableau10);
const UNTAGGED_COLOR = '#9ca3af';

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent, EmptyStateComponent],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgRef', { static: true }) svgRef!: ElementRef<SVGSVGElement>;

  private api = inject(DocumentsApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private simulation: d3.Simulation<SimNode, SimEdge> | null = null;

  loading = signal(true);
  isEmpty = signal(false);
  loadFailed = signal(false);

  async ngAfterViewInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.api.graph());
      this.loading.set(false);
      if (data.nodes.length === 0) {
        this.isEmpty.set(true);
        return;
      }
      this.render(data.nodes, data.edges);
    } catch {
      this.loading.set(false);
      this.loadFailed.set(true);
    }
  }

  ngOnDestroy(): void {
    this.simulation?.stop();
  }

  private render(nodes: GraphNode[], edges: GraphEdge[]): void {
    const focusId = this.route.snapshot.queryParamMap.get('focus');
    const svgEl = this.svgRef.nativeElement;
    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 600;

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));

    const neighborIds = new Set<string>();
    if (focusId) {
      neighborIds.add(focusId);
      for (const e of edges) {
        if (e.source === focusId) neighborIds.add(e.target);
        if (e.target === focusId) neighborIds.add(e.source);
      }
    }

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    const root = svg.append('g');

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 3])
        .on('zoom', (event) => root.attr('transform', event.transform)),
    );

    const link = root
      .append('g')
      .attr('stroke', '#d1d5db')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke-width', 1.2);

    const colorFor = (node: SimNode) =>
      node.tags.length > 0 ? TAG_COLOR_SCALE(node.tags[0]) : UNTAGGED_COLOR;

    const node = root
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(this.dragBehavior());

    node
      .append('circle')
      .attr('r', 10)
      .attr('fill', colorFor)
      .attr('opacity', (d) => (neighborIds.size === 0 || neighborIds.has(d.id) ? 1 : 0.25));

    node
      .append('text')
      .text((d) => d.title)
      .attr('x', 14)
      .attr('y', 4)
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .attr('opacity', (d) => (neighborIds.size === 0 || neighborIds.has(d.id) ? 1 : 0.3));

    node.on('click', (_event, d) => this.router.navigate(['/documents', d.id]));

    node.on('mouseenter', (_event, hovered) => {
      const neighbors = new Set([hovered.id]);
      for (const e of edges) {
        if (e.source === hovered.id) neighbors.add(e.target);
        if (e.target === hovered.id) neighbors.add(e.source);
      }
      node.selectAll('circle').attr('opacity', (d) => (neighbors.has((d as SimNode).id) ? 1 : 0.15));
      node.selectAll('text').attr('opacity', (d) => (neighbors.has((d as SimNode).id) ? 1 : 0.15));
      link.attr('opacity', (e) => {
        const edge = e as SimEdge;
        const s = typeof edge.source === 'object' ? (edge.source as SimNode).id : edge.source;
        const t = typeof edge.target === 'object' ? (edge.target as SimNode).id : edge.target;
        return s === hovered.id || t === hovered.id ? 1 : 0.1;
      });
    });

    node.on('mouseleave', () => {
      node.selectAll('circle').attr('opacity', 1);
      node.selectAll('text').attr('opacity', 1);
      link.attr('opacity', 1);
    });

    this.simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(90),
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(28))
      .on('tick', () => {
        link
          .attr('x1', (d) => (d.source as SimNode).x!)
          .attr('y1', (d) => (d.source as SimNode).y!)
          .attr('x2', (d) => (d.target as SimNode).x!)
          .attr('y2', (d) => (d.target as SimNode).y!);
        node.attr('transform', (d) => `translate(${d.x}, ${d.y})`);
      });
  }

  private dragBehavior() {
    return d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) this.simulation?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }
}
