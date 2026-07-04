import { getFullText } from '../server/fulltextCore'

interface SampleEntry {
  label?: string
  pmcid?: string
  pmid?: string
  doi?: string
  arxivId?: string
}

// Sample of VERIFIED-REAL identifiers (each DOI confirmed to resolve on
// doi.org and to exist in Unpaywall; arXiv IDs confirmed to fetch; PMCID/PMID
// confirmed real). Do not add an identifier here without checking it resolves
// against the live services first — fabricated IDs silently look like fallbacks
// and corrupt the measurement.
const SAMPLE: SampleEntry[] = [
  // arXiv papers (all resolve on arxiv.org/html)
  { label: 'arXiv: Attention Is All You Need', arxivId: '1706.03762' },
  { label: 'arXiv: BERT', arxivId: '1810.04805' },
  { label: 'arXiv: Vision Transformer', arxivId: '2010.11929' },
  { label: 'arXiv: ResNet', arxivId: '1512.03385' },
  { label: 'arXiv: Transformer-XL', arxivId: '1901.02860' },
  { label: 'arXiv: ELECTRA', arxivId: '2003.10555' },
  { label: 'arXiv: RoBERTa', arxivId: '1907.11692' },
  { label: 'arXiv: XLNet', arxivId: '1906.08237' },

  // Biomedical by PMCID/PMID (real)
  { label: 'PMCID: PLoS Pathogens (PMC3257301)', pmcid: 'PMC3257301' },
  { label: 'PMID: same article by PMID', pmid: '22253597' },

  // Open-access publisher DOIs (Unpaywall=OA; many resolve in-app via PMC/Europe PMC)
  { label: 'PLOS Medicine (PRISMA)', doi: '10.1371/journal.pmed.1000097' },
  { label: 'PLOS ONE', doi: '10.1371/journal.pone.0227181' },
  { label: 'eLife', doi: '10.7554/eLife.00013' },
  { label: 'Nature Communications OA', doi: '10.1038/s41467-019-09234-6' },
  { label: 'Genome Biology (BMC)', doi: '10.1186/s13059-019-1832-y' },
  { label: 'Scientific Reports OA', doi: '10.1038/s41598-020-77291-9' },
  { label: 'JMIR', doi: '10.2196/17971' },
  { label: 'Frontiers in Microbiology', doi: '10.3389/fmicb.2020.560482' },
  { label: 'BMJ (PRISMA 2020)', doi: '10.1136/bmj.n71' },
  { label: 'PNAS', doi: '10.1073/pnas.1516684112' },
  { label: 'Oxford Nucleic Acids Research', doi: '10.1093/nar/gkw1099' },
  { label: 'Science (AAAS)', doi: '10.1126/science.1260419' },

  // Publisher-hosted / mixed-access DOIs (test in-app miss + Unpaywall free link)
  { label: 'Cell (Elsevier)', doi: '10.1016/j.cell.2011.02.013' },
  { label: 'Algorithmica (Springer)', doi: '10.1007/s00453-019-00634-0' },
  { label: 'IEEE TPAMI (closed)', doi: '10.1109/TPAMI.2016.2572683' },
]

interface Measurement {
  label?: string
  available: boolean
  source?: string
  sectionCount: number
  freeUrl?: string
  error?: string
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('Starting full-text coverage measurement...\n')

  const results: Measurement[] = []
  const sourceCount = new Map<string, number>()
  let hits = 0
  let fallbacks = 0

  for (let i = 0; i < SAMPLE.length; i++) {
    const entry = SAMPLE[i]
    try {
      const result = await getFullText({
        pmcid: entry.pmcid,
        pmid: entry.pmid,
        doi: entry.doi,
        arxivId: entry.arxivId
      })

      if (result.available) {
        hits++
        const source = result.source
        sourceCount.set(source, (sourceCount.get(source) || 0) + 1)
        results.push({
          label: entry.label,
          available: true,
          source,
          sectionCount: result.sections.length
        })
      } else {
        fallbacks++
        results.push({
          label: entry.label,
          available: false,
          sectionCount: 0,
          freeUrl: result.freeUrl
        })
      }
    } catch (err) {
      fallbacks++
      results.push({
        label: entry.label,
        available: false,
        sectionCount: 0,
        error: String(err)
      })
    }

    // Be polite to APIs: wait between requests
    if (i < SAMPLE.length - 1) {
      await sleep(300)
    }
  }

  // Print summary
  const total = results.length
  const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : '0'

  console.log('=== Full-Text Coverage Summary ===\n')
  console.log(`Total articles sampled: ${total}`)
  console.log(`In-app hits: ${hits}`)
  console.log(`Fallbacks: ${fallbacks}`)
  console.log(`Hit rate: ${hitRate}%\n`)

  console.log('=== Breakdown by Source ===')
  if (sourceCount.size === 0) {
    console.log('(no hits)')
  } else {
    for (const [source, count] of sourceCount) {
      console.log(`${source}: ${count}`)
    }
  }

  console.log('\n=== Fallback Details ===')
  const fallbackEntries = results.filter(r => !r.available)
  if (fallbackEntries.length === 0) {
    console.log('(no fallbacks)')
  } else {
    for (const entry of fallbackEntries) {
      console.log(`- ${entry.label || '(unlabeled)'}`)
    }
  }

  console.log('\n=== Unpaywall Free Links ===')
  const withFreeUrl = results.filter(r => !r.available && r.freeUrl)
  console.log(`Fallbacks with a free link (Unpaywall): ${withFreeUrl.length}`)

  process.exit(0)
}

main().catch(err => {
  console.error('Error during measurement:', err)
  process.exit(1)
})
