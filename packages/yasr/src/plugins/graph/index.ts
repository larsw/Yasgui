import { isEqual, uniqBy, flatten } from "lodash-es";
import { Plugin } from "../";
import Yasr, { Parser } from "../../";
import { drawSvgStringAsElement, drawFontAwesomeIconAsSvg } from "@triply/yasgui-utils";
import * as graphIcon from "@fortawesome/free-solid-svg-icons/faProjectDiagram";
import * as d3 from "d3";

type NodeDatum = Parser.BindingValue & d3.SimulationNodeDatum;
type LinkDatum = d3.SimulationLinkDatum<NodeDatum>;
interface Data {
  nodes: NodeDatum[];
  links: LinkDatum[];
}

const getLocalName = (iri: string) =>
  iri.indexOf("#") >= 0 ? iri.split("#").slice(-1)[0] : iri.split("/").slice(-1)[0];

export default class Graph implements Plugin<{}> {
  private yasr: Yasr;
  public label = "Graph";
  public priority = 100;

  constructor(yasr: Yasr) {
    this.yasr = yasr;
  }

  private getData(results: Parser.Binding[]): Data {
    const nodes = uniqBy(flatten(results.map(r => [r.subject, r.object])), b => b.value);
    const links = results.map(r => ({ ...r.predicate, source: r.subject.value, target: r.object.value }));
    return {
      nodes: nodes,
      links: links
    };
  }

  private drag(simulation: d3.Simulation<NodeDatum, LinkDatum>) {
    function dragstarted(d: NodeDatum) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d: NodeDatum) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d: NodeDatum) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  private drawGraph(rootEl: HTMLDivElement, data: Data) {
    const width = rootEl.getBoundingClientRect().width;
    const height = 900;
    const radius = 50;

    const simulation = d3
      .forceSimulation<NodeDatum>(data.nodes as any)
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id((d: any) => d.value)
          .distance(200)
      )
      .force("charge", d3.forceManyBody().strength(-10000))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const svg = d3
      .select(rootEl)
      .selectAll<SVGSVGElement, number>("svg")
      .data([0])
      .join(enter => {
        const svg = enter
          .append("svg")
          .attr("width", width)
          .attr("height", height);
        svg.append("g");
        return svg;
      });

    svg
      .append("svg:defs")
      .selectAll("marker")
      .data(["end"])
      .enter()
      .append("svg:marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 33)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 10)
      .attr("markerHeight", 10)
      .attr("markerUnits", "strokeWidth")
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#ccc");

    const link = svg
      .select("g")
      .selectAll<SVGLineElement, LinkDatum>("line.link")
      .data(data.links)
      .enter()
      .append("line")
      .classed("link", true)
      .style("stroke", "#aaa")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // const linkLabels = svg
    //   .select("g")
    //   .selectAll<SVGTextElement, LinkDatum>("text.linkLabel")
    //   .data(data.links)
    //   .enter()
    //   .append("text")
    //   .classed("linkLabel", true)
    //   .style("pointer-events", "none")
    //   .attr("fill", "#aaa")
    //   .attr("id", function(d, i) {
    //     return "linkLabel" + i;
    //   });
    //
    // linkLabels
    //   .append("textPath")
    //   .attr("xlink:href", function(d, i) {
    //     return "#edgepath" + i;
    //   })
    //   .style("text-anchor", "middle")
    //   .style("pointer-events", "none")
    //   .attr("startOffset", "50%")
    //   .text((d: any) => getLocalName(d.value));

    const node = svg
      .select("g")
      .selectAll<SVGCircleElement, NodeDatum>("circle.node")
      .data(data.nodes)
      .enter()
      .append("circle")
      .classed("node", true)
      .attr("r", radius)
      .style("fill", "#69b3a2")
      .call(this.drag(simulation));

    const nodeLabel = svg
      .select("g")
      .selectAll<SVGTextElement, NodeDatum>("text.nodeLabel")
      .data(data.nodes)
      .enter()
      .append("text")
      .classed("nodeLabel", true)
      .text(d => getLocalName(d.value))
      .attr("alignment-baseline", "central")
      .style("font-size", function() {
        this.style.fontSize = "1em";
        return `${(0.9 * 2 * radius) / this.getComputedTextLength()}em`;
      })
      .attr("dx", -0.9 * radius);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", d => d.x).attr("cy", d => d.y);
      nodeLabel.attr("x", d => d.x).attr("y", d => d.y);

      // linkLabels.attr("x", d => d.source.x).attr("y", d => d.source.y);
      // linkLabels.attr("transform", function(d: any) {
      //   if (d.target.x < d.source.x) {
      //     const bbox = this.getBBox();
      //     const rx = bbox.x + bbox.width / 2;
      //     const ry = bbox.y + bbox.height / 2;
      //     return "rotate(180 " + rx + " " + ry + ")";
      //   } else {
      //     return "rotate(0)";
      //   }
      // });
    });
  }

  public draw() {
    const rootEl = document.createElement("div");
    this.yasr.resultsEl.appendChild(rootEl);
    const results = this.yasr.results.getBindings();
    this.drawGraph(rootEl, this.getData(results));
  }

  public canHandleResults() {
    return (
      !!this.yasr.results && isEqual(this.yasr.results.getVariables(), ["subject", "predicate", "object", "graph"])
    );
  }

  public getIcon() {
    return drawSvgStringAsElement(drawFontAwesomeIconAsSvg(graphIcon));
  }
}
