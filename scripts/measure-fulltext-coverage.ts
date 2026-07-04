import { getFullText } from '../server/fulltextCore'

interface SampleEntry {
  label?: string
  pmcid?: string
  pmid?: string
  doi?: string
  arxivId?: string
}

// Diverse sample of real identifiers
const SAMPLE: SampleEntry[] = [
  // arXiv papers
  { label: 'arXiv: Attention Is All You Need', arxivId: '1706.03762' },
  { label: 'arXiv: BERT', arxivId: '1810.04805' },
  { label: 'arXiv: GPT-2', arxivId: '1902.10673' },
  { label: 'arXiv: Vision Transformer', arxivId: '2010.11929' },
  { label: 'arXiv: ResNet', arxivId: '1512.03385' },

  // PMC/PMID open-access biomedical
  { label: 'PMC: Open-access oncology paper', pmcid: 'PMC3257301' },
  { label: 'PMID: PubMed central paper', pmid: '22253597' },
  { label: 'PMID: Immunology paper', pmid: '25945375' },

  // Open-access publishers (PLOS, eLife, BMC, Nature Comms)
  { label: 'PLOS Medicine', doi: '10.1371/journal.pmed.1000097' },
  { label: 'PLOS ONE', doi: '10.1371/journal.pone.0227181' },
  { label: 'eLife paper', doi: '10.7554/eLife.00013' },
  { label: 'BMC article', doi: '10.1186/gb-2007-6-8-r70' },
  { label: 'Nature Communications OA', doi: '10.1038/s41467-021-21335-7' },

  // Likely paywalled/closed (Elsevier, Springer, Wiley)
  { label: 'Elsevier paywalled', doi: '10.1016/j.jss.2020.110843' },
  { label: 'Springer paywalled', doi: '10.1007/978-3-319-24574-4_28' },
  { label: 'Wiley paywalled', doi: '10.1111/j.1469-0691.2008.02129.x' },
  { label: 'Science Translational Medicine', doi: '10.1126/scitranslmed.3004266' },

  // Additional arXiv papers
  { label: 'arXiv: Transformer-XL', arxivId: '1901.02860' },
  { label: 'arXiv: ELECTRA', arxivId: '2003.10555' },
  { label: 'arXiv: RoBERTa', arxivId: '1907.11692' },
  { label: 'arXiv: XLNet', arxivId: '1906.08237' },

  // Additional biomedical papers
  { label: 'PMC: COVID-19 research', pmcid: 'PMC8139999' },
  { label: 'PMID: Gene therapy', pmid: '31048769' },
  { label: 'PMID: Cancer biology', pmid: '29038445' },

  // Additional OA publishers
  { label: 'Frontiers paper', doi: '10.3389/fmicb.2021.645609' },
  { label: 'JMIR paper', doi: '10.2196/17971' },
  { label: 'Scientific Reports OA', doi: '10.1038/s41598-020-77291-9' },

  // Some additional paywalled
  { label: 'Taylor & Francis', doi: '10.1080/03610918.2019.1649288' },
  { label: 'IEEE paywalled', doi: '10.1109/TPAMI.2016.2572683' },
]

interface Measurement {
  label?: string
  available: boolean
  source?: string
  sectionCount: number
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
          sectionCount: 0
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

  process.exit(0)
}

main().catch(err => {
  console.error('Error during measurement:', err)
  process.exit(1)
})
