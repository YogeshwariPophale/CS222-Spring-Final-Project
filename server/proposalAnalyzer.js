/**
 * Graduate-level proposal analysis module
 * Provides scoring, reference validation, and language analysis
 */

export function analyzeProposal(proposal, complianceMatrix = []) {
  const referenceAnalysis = analyzeReferences(proposal);
  const languageAnalysis = analyzeLanguage(proposal);
  const timelineAnalysis = analyzeTimeline(proposal);
  const budgetAnalysis = analyzeBudget(proposal);
  const scores = calculateProposalScores(proposal, complianceMatrix, referenceAnalysis, languageAnalysis);

  return {
    scores,
    referenceAnalysis,
    languageAnalysis,
    timelineAnalysis,
    budgetAnalysis,
    graduateReadiness: assessGraduateReadiness(proposal, scores),
    recommendations: generateRecommendations(proposal, scores, referenceAnalysis, languageAnalysis)
  };
}

function analyzeReferences(proposal) {
  const references = String(proposal.references || '').trim();
  const problem = String(proposal.problem || '').trim();
  const method = String(proposal.method || '').trim();
  const evaluation = String(proposal.evaluation || '').trim();

  const refLines = references.split(/\n|;/).filter(line => line.trim().length > 18);
  const citationPatterns = /\((?:[A-Z][A-Za-z-]+(?:\s+et al\.)?,\s*)?(?:19|20)\d{2}\)|\[(?:\d+)\]/gi;
  const citationsInText = (problem + method + evaluation).match(citationPatterns) || [];

  const hasAPA = /^\[\d+\]/m.test(references) || /\([A-Z][A-Za-z-]+,\s*(?:19|20)\d{2}\)/m.test(references);
  const hasLinks = /https?:|doi/i.test(references);
  const hasProperFormat = hasAPA || (/et al\./i.test(references) && /\b(?:19|20)\d{2}\b/.test(references));

  const referenceScore = Math.min(100, Math.max(0, 
    Math.min(refLines.length * 8, 48) +
    Math.min(citationsInText.length * 8, 16) +
    (hasProperFormat ? 18 : 0) +
    (hasLinks ? 12 : 0) +
    (/claim|supports|evidence|source note|ground/i.test(references) ? 6 : 0)
  ));

  return {
    count: refLines.length,
    citationsInText: citationsInText.length,
    hasProperFormat,
    quality: referenceScore >= 85 ? 'Excellent' : referenceScore >= 70 ? 'Good' : referenceScore >= 50 ? 'Adequate' : 'Needs Improvement',
    score: Math.round(referenceScore),
    suggestions: generateReferenceSuggestions(refLines, citationsInText.length)
  };
}

function generateReferenceSuggestions(refLines, citationCount) {
  const suggestions = [];
  
  if (refLines.length < 5) {
    suggestions.push('Add at least five credible references or source notes');
  }
  if (citationCount === 0) {
    suggestions.push('Cite references in problem and method sections to support claims');
  }
  if (refLines.length > 0 && !refLines.some((ref) => /http|doi/i.test(ref))) {
    suggestions.push('Include DOI or URL links for verifiability');
  }
  
  return suggestions;
}

function analyzeLanguage(proposal) {
  const allText = Object.values(proposal)
    .filter(v => typeof v === 'string')
    .join(' ');

  const words = allText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Technical term detection
  const technicalTerms = [
    'algorithm', 'framework', 'architecture', 'optimization', 'machine learning',
    'neural', 'regression', 'classification', 'evaluation', 'metrics', 'benchmark',
    'scalability', 'latency', 'throughput', 'robustness', 'validation',
    'hypothesis', 'empirical', 'statistical', 'inference', 'gradient', 'convergence'
  ];

  const technicalTermCount = technicalTerms.filter(term => 
    allText.toLowerCase().includes(term)
  ).length;

  // Academic markers
  const academicMarkers = [
    'research', 'propose', 'investigate', 'demonstrate', 'evaluate', 'analysis',
    'significant', 'novel', 'contribute', 'methodology', 'framework', 'approach'
  ];

  const academicMarkerCount = academicMarkers.filter(marker =>
    allText.toLowerCase().includes(marker)
  ).length;

  const avgSentenceLength = words.length / Math.max(sentences.length, 1);
  const avgWordLength = allText.replace(/\s/g, '').length / Math.max(words.length, 1);

  // Scoring
  const technicalDepth = Math.min(100, (technicalTermCount / 10) * 100);
  const academicTone = Math.min(100, (academicMarkerCount / 12) * 100);
  const readability = avgSentenceLength >= 12 && avgSentenceLength <= 28
    ? 90
    : Math.min(70, Math.max(20, 90 - Math.abs(avgSentenceLength - 20) * 4));
  const complexity = avgWordLength > 5.2 ? 85 : avgWordLength > 4.7 ? 70 : 45;

  const languageScore = Math.round((technicalDepth + academicTone + readability + complexity) / 4);

  return {
    technicalTermCount,
    academicMarkerCount,
    averageSentenceLength: Math.round(avgSentenceLength),
    averageWordLength: Math.round(avgWordLength * 10) / 10,
    technicalDepth: Math.round(technicalDepth),
    academicTone: Math.round(academicTone),
    readability: Math.round(readability),
    complexity: Math.round(complexity),
    overallScore: languageScore,
    level: languageScore >= 80 ? 'Graduate Level' : languageScore >= 60 ? 'Upper Undergraduate' : 'Needs Development'
  };
}

function analyzeTimeline(proposal) {
  const timeline = String(proposal.timeline || '').toLowerCase();
  
  // Extract duration
  const durationMatch = timeline.match(/(\d+)\s*(month|year|week)/i);
  const months = durationMatch 
    ? (durationMatch[2].toLowerCase().startsWith('y') ? parseInt(durationMatch[1]) * 12 : parseInt(durationMatch[1]))
    : 6;

  // Check for realistic graduate timeline
  const isRealistic = months >= 4 && months <= 36; // 4 months to 3 years
  const hasMilestones = /phase|stage|quarter|month|week|year \d+|milestone/i.test(timeline);
  const hasDeliverables = /deliverable|output|result|publication|prototype|draft|test|revision/i.test(timeline);

  return {
    estimatedMonths: months,
    hasPhases: hasMilestones,
    hasDeliverables,
    isRealistic,
    rigorScore: isRealistic && hasMilestones && hasDeliverables ? 'Rigorous' : isRealistic ? 'Adequate' : 'Needs Refinement',
    suggestions: timeline.length < 50 ? ['Add more detailed timeline with specific phases and milestones'] : []
  };
}

function analyzeBudget(proposal) {
  const resources = String(proposal.resources || '').toLowerCase();
  
  const budgetMatch = resources.match(/\$(\d+)[kK]?|\d+\s*(?:k|thousand|million)/i);
  const amount = budgetMatch ? parseInt(budgetMatch[1]) : null;

  const hasComputeResources = /compute|gpu|cloud|server|infrastructure|hardware/i.test(resources);
  const hasHumanResources = /team|personnel|advisor|student|researcher/i.test(resources);
  const hasToolsLicenses = /software|tool|license|subscription|api/i.test(resources);

  const isRealistic = amount && ((amount >= 30 && amount <= 500) || amount >= 5000);

  return {
    estimatedBudget: amount ? `$${amount}k` : 'Not specified',
    hasComputeResources,
    hasHumanResources,
    hasToolsLicenses,
    isRealistic,
    completeness: (hasComputeResources ? 1 : 0) + (hasHumanResources ? 1 : 0) + (hasToolsLicenses ? 1 : 0),
    suggestions: !hasComputeResources ? ['Specify computational resource requirements'] : []
  };
}

function calculateProposalScores(proposal, complianceMatrix, refAnalysis, langAnalysis) {
  // Component scores
  const completionScore = calculateCompletionScore(proposal, complianceMatrix);
  const clarityScore = langAnalysis.overallScore;
  const technicalScore = calculateTechnicalScore(proposal, langAnalysis);
  const referenceScore = refAnalysis.score;
  const researchQualityScore = calculateResearchQuality(proposal);

  // Weighted scoring
  const finalScore = Math.round(
    (completionScore * 0.20) +
    (clarityScore * 0.20) +
    (technicalScore * 0.20) +
    (referenceScore * 0.15) +
    (researchQualityScore * 0.25)
  );

  return {
    overall: finalScore,
    completion: completionScore,
    clarity: clarityScore,
    technical: technicalScore,
    references: referenceScore,
    researchQuality: researchQualityScore,
    grade: finalScore >= 90 ? 'A' : finalScore >= 80 ? 'B' : finalScore >= 70 ? 'C' : 'Needs Work',
    gradeColor: finalScore >= 90 ? 'excellent' : finalScore >= 80 ? 'good' : finalScore >= 70 ? 'fair' : 'poor'
  };
}

function calculateCompletionScore(proposal, complianceMatrix) {
  const required = [
    ['title', 15],
    ['problem', 280],
    ['method', 360],
    ['evaluation', 280],
    ['references', 160],
    ['timeline', 140],
    ['resources', 120]
  ];
  const completed = required.filter(([field, minLength]) => String(proposal[field] || '').trim().length >= minLength).length;

  const complianceScore = complianceMatrix.length > 0
    ? (complianceMatrix.filter(r => /covered/i.test(r.status)).length / complianceMatrix.length) * 50
    : 0;

  return Math.round((completed / required.length) * 50 + complianceScore);
}

function calculateTechnicalScore(proposal, langAnalysis) {
  const methodText = String(proposal.method || '').length;
  const evaluationText = String(proposal.evaluation || '').length;
  const resourcesText = String(proposal.resources || '').length;

  const detailScore = Math.min(100, (methodText / 550) * 100);
  const evaluationScore = Math.min(100, (evaluationText / 420) * 100);
  const resourceScore = Math.min(100, (resourcesText / 220) * 100);

  return Math.round(
    (langAnalysis.technicalDepth * 0.4) +
    (detailScore * 0.3) +
    (evaluationScore * 0.2) +
    (resourceScore * 0.1)
  );
}

function calculateResearchQuality(proposal) {
  const problem = String(proposal.problem || '');
  const method = String(proposal.method || '');
  const title = String(proposal.title || '');

  // Novelty markers
  const noveltyMarkers = /novel|new|first|propose|extend|improve|enhance|innovative/i;
  const noveltyScore = noveltyMarkers.test(method) ? 30 : 10;

  // Significance markers
  const significanceMarkers = /impact|important|benefit|contribution|significant|advance|gap|lack|insufficient|need/i;
  const significanceScore = significanceMarkers.test(problem) && problem.length > 250 ? 30 : 10;

  // Feasibility
  const evaluation = String(proposal.evaluation || '');
  const feasibilityScore = problem.length > 250 && method.length > 350 && evaluation.length > 250 ? 40 : 12;

  return Math.min(100, noveltyScore + significanceScore + feasibilityScore);
}

function assessGraduateReadiness(proposal, scores) {
  const requirements = [
    { name: 'Research Question Clarity', met: scores.researchQuality >= 80 },
    { name: 'Technical Depth', met: scores.technical >= 75 },
    { name: 'Proper References', met: scores.references >= 70 },
    { name: 'Clear Methodology', met: String(proposal.method || '').length > 350 },
    { name: 'Evaluation Plan', met: String(proposal.evaluation || '').length > 250 },
    { name: 'Realistic Timeline', met: String(proposal.timeline || '').length > 120 },
    { name: 'Resource Planning', met: String(proposal.resources || '').length > 100 }
  ];

  const readinessMet = requirements.filter(r => r.met).length;
  const readinessPercent = Math.round((readinessMet / requirements.length) * 100);

  return {
    readinessPercent,
    readinessLevel: readinessPercent >= 85 ? 'Ready for serious revision' : readinessPercent >= 70 ? 'Promising but not submission-ready' : 'Needs Refinement',
    checklist: requirements
  };
}

function generateRecommendations(proposal, scores, refAnalysis, langAnalysis) {
  const recommendations = [];

  if (scores.overall < 70) {
    recommendations.push({
      priority: 'High',
      area: 'Overall Quality',
      message: 'Proposal needs significant improvements in multiple areas. Focus on core components first.'
    });
  }

  if (scores.clarity < 70) {
    recommendations.push({
      priority: 'High',
      area: 'Writing Clarity',
      message: `Use more academic language and longer sentences. Current: ${langAnalysis.averageSentenceLength} words/sentence.`
    });
  }

  if (scores.technical < 70) {
    recommendations.push({
      priority: 'High',
      area: 'Technical Depth',
      message: `Increase technical terminology. Current: ${langAnalysis.technicalTermCount} technical terms used.`
    });
  }

  if (scores.references < 60) {
    recommendations.push({
      priority: 'High',
      area: 'References',
      message: refAnalysis.suggestions[0] || 'Improve reference quality and quantity.'
    });
  }

  if (String(proposal.evaluation || '').length < 100) {
    recommendations.push({
      priority: 'Medium',
      area: 'Evaluation Plan',
      message: 'Expand evaluation plan with specific metrics and success criteria.'
    });
  }

  if (scores.researchQuality < 70) {
    recommendations.push({
      priority: 'Medium',
      area: 'Research Quality',
      message: 'Emphasize novelty and significance of the research contribution.'
    });
  }

  return recommendations;
}

export function validateReferences(references) {
  const refLines = String(references || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const issues = [];
  const warnings = [];

  refLines.forEach((ref, index) => {
    // Check for year format
    if (!/\b(19|20)\d{2}\b/.test(ref)) {
      warnings.push(`Reference ${index + 1}: Missing publication year`);
    }

    // Check for URL or DOI
    if (!/http|doi|dx\.doi/i.test(ref)) {
      warnings.push(`Reference ${index + 1}: No URL or DOI provided`);
    }

    // Check for author names
    if (!/^[A-Z][a-z]+/i.test(ref)) {
      issues.push(`Reference ${index + 1}: May not start with author name`);
    }
  });

  return {
    totalReferences: refLines.length,
    issues,
    warnings,
    quality: issues.length === 0 && warnings.length <= 2 ? 'Good' : issues.length > 0 ? 'Needs Review' : 'Fair'
  };
}
