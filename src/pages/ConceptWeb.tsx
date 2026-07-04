import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import { useRecentsStore } from '../stores/recentsStore'
import { getWorkById, shortIdOf } from '../utils/openalexApi'
import { Article, Concept } from '../types'
import './ConceptWeb.css'

interface WebNode {
  id: string
  shortId: string
  title: string
  concepts: Concept[]
  x?: number
  y?: number
  fx?: number
  fy?: number
}

interface WebLink {
  source: string
  target: string
  shared: string[]
  weight: number
}

const W = 720
const H = 720
const PADDING = 40

export default function ConceptWeb() {
  const navigate = useNavigate()
  const { recents } = useRecentsStore()
  const { enrichRecent } = useRecentsStore()
  const [loading, setLoading] = useState(false)
  const [nodes, setNodes] = useState<WebNode[]>([])
  const [links, setLinks] = useState<WebLink[]>([])

  // Step 1: Backfill/enrich recents to ensure they have concepts
  useEffect(() => {
    const enrichRecents = async () => {
      const toEnrich = recents.filter(r => !r.concepts || r.concepts.length === 0)

      if (toEnrich.length === 0) {
        // All recents are enriched, build the graph
        buildGraph(recents)
        return
      }

      setLoading(true)
      const results = await Promise.allSettled(
        toEnrich.map(article => getWorkById(shortIdOf(article.id)))
      )

      // Update store with enriched articles
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          enrichRecent(result.value)
        }
      })

      setLoading(false)
      // Graph will be built in the next effect when recents are updated
    }

    enrichRecents()
  }, [recents.length]) // Only re-run if the number of recents changes (first load)

  // Step 2: Build graph from enriched recents
  useEffect(() => {
    if (!loading) {
      buildGraph(recents)
    }
  }, [recents, loading])

  const buildGraph = (articles: Article[]) => {
    // Filter to articles with >= 1 concept
    const articlesWithConcepts = articles.filter(a => a.concepts && a.concepts.length >= 1)

    if (articlesWithConcepts.length === 0) {
      setNodes([])
      setLinks([])
      return
    }

    // Create nodes
    const graphNodes: WebNode[] = articlesWithConcepts.map(article => ({
      id: article.id,
      shortId: shortIdOf(article.id),
      title: article.title,
      concepts: article.concepts || []
    }))

    // Create links: find pairs of nodes sharing >= 1 concept
    const graphLinks: WebLink[] = []
    const addedLinks = new Set<string>()

    for (let i = 0; i < graphNodes.length; i++) {
      for (let j = i + 1; j < graphNodes.length; j++) {
        const nodeA = graphNodes[i]
        const nodeB = graphNodes[j]

        const conceptAIds = new Set(nodeA.concepts.map(c => c.id))
        const shared = nodeB.concepts
          .filter(c => conceptAIds.has(c.id))
          .map(c => c.name)

        if (shared.length > 0) {
          const linkKey = [nodeA.id, nodeB.id].sort().join('|')
          if (!addedLinks.has(linkKey)) {
            graphLinks.push({
              source: nodeA.id,
              target: nodeB.id,
              shared,
              weight: shared.length
            })
            addedLinks.add(linkKey)
          }
        }
      }
    }

    // Layout with d3-force: settle the simulation
    const simNodes = graphNodes.map(n => ({ ...n }))
    const simLinks = graphLinks.map(l => ({ ...l }))

    const sim = forceSimulation<any>(simNodes)
      .force('link', forceLink<any, any>(simLinks).id((d: any) => d.id).distance(120))
      .force('charge', forceManyBody().strength(-320))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(46))

    // Run to settle (300 ticks)
    sim.stop()
    for (let i = 0; i < 300; i++) {
      sim.tick()
    }

    // Clamp positions to canvas bounds
    simNodes.forEach(node => {
      node.x = Math.max(PADDING, Math.min(W - PADDING, node.x || W / 2))
      node.y = Math.max(PADDING, Math.min(H - PADDING, node.y || H / 2))
    })

    setNodes(simNodes)
    // Store the original graphLinks (string source/target ids), NOT simLinks:
    // forceLink mutates simLinks in place, replacing each string id with a node
    // object reference, which would break the render's `nodes.find(n => n.id === link.source)`.
    setLinks(graphLinks)
  }

  const handleNodeClick = (node: WebNode) => {
    navigate(`/reader/${node.shortId}`)
  }

  // Calculate node degree (number of links)
  const nodeDegrees = new Map<string, number>()
  links.forEach(link => {
    nodeDegrees.set(link.source, (nodeDegrees.get(link.source) || 0) + 1)
    nodeDegrees.set(link.target, (nodeDegrees.get(link.target) || 0) + 1)
  })

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1>Concept Web</h1>
        </div>
        <div className="loading-state">
          <p>Building your concept web…</p>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1>Concept Web</h1>
        </div>
        <div className="empty-state">
          <h2>Your concept web is empty</h2>
          <p>Read a few articles and they'll appear here, linked when they share a research topic.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Concept Web</h1>
      </div>

      <div className="concept-web-container">
        <div className="concept-web-header">
          <p className="concept-web-stats">
            {nodes.length} {nodes.length === 1 ? 'article' : 'articles'} · {links.length} {links.length === 1 ? 'connection' : 'connections'}
          </p>
        </div>

        <div className="concept-web-scroll">
          <svg width={W} height={H} className="concept-web-svg">
            {/* Draw links */}
            {links.map((link, idx) => {
              const sourceNode = nodes.find(n => n.id === link.source)
              const targetNode = nodes.find(n => n.id === link.target)

              if (!sourceNode || !targetNode) return null

              return (
                <line
                  key={idx}
                  x1={sourceNode.x || 0}
                  y1={sourceNode.y || 0}
                  x2={targetNode.x || 0}
                  y2={targetNode.y || 0}
                  stroke="var(--color-border)"
                  strokeWidth={Math.min(1 + link.weight, 5)}
                  className="concept-web-link"
                />
              )
            })}

            {/* Draw nodes */}
            {nodes.map(node => {
              const degree = nodeDegrees.get(node.id) || 0
              const nodeRadius = 10 + Math.min(degree * 2, 14)

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x || W / 2},${node.y || H / 2})`}
                  onClick={() => handleNodeClick(node)}
                  role="button"
                  aria-label={node.title}
                  className="concept-web-node"
                >
                  <circle r={nodeRadius} fill="var(--color-accent)" className="concept-web-circle" />
                  <text
                    textAnchor="middle"
                    y={nodeRadius + 14}
                    className="concept-web-label"
                  >
                    {node.title.length > 24 ? node.title.slice(0, 24) + '…' : node.title}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
