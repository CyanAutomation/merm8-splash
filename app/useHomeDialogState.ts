import { useCallback, useState } from 'react'

interface HomeDialogVisibility {
  isResetConfirmationOpen: boolean
  isRulesOpen: boolean
  isApiConfigurationOpen: boolean
  isFullscreenOpen: boolean
  showMetrics: boolean
  isSemanticReviewOpen: boolean
}

const initialVisibility: HomeDialogVisibility = {
  isResetConfirmationOpen: false,
  isRulesOpen: false,
  isApiConfigurationOpen: false,
  isFullscreenOpen: false,
  showMetrics: false,
  isSemanticReviewOpen: false,
}

export function useHomeDialogState() {
  const [visibility, setVisibility] = useState(initialVisibility)

  const openResetConfirmation = useCallback(() => {
    setVisibility((current) => ({ ...current, isResetConfirmationOpen: true }))
  }, [])
  const closeResetConfirmation = useCallback(() => {
    setVisibility((current) => ({ ...current, isResetConfirmationOpen: false }))
  }, [])
  const openRules = useCallback(() => {
    setVisibility((current) => ({ ...current, isRulesOpen: true }))
  }, [])
  const closeRules = useCallback(() => {
    setVisibility((current) => ({ ...current, isRulesOpen: false }))
  }, [])
  const openApiConfiguration = useCallback(() => {
    setVisibility((current) => ({ ...current, isApiConfigurationOpen: true }))
  }, [])
  const closeApiConfiguration = useCallback(() => {
    setVisibility((current) => ({ ...current, isApiConfigurationOpen: false }))
  }, [])
  const openFullscreen = useCallback(() => {
    setVisibility((current) => ({ ...current, isFullscreenOpen: true }))
  }, [])
  const closeFullscreen = useCallback(() => {
    setVisibility((current) => ({ ...current, isFullscreenOpen: false }))
  }, [])
  const toggleMetrics = useCallback(() => {
    setVisibility((current) => ({ ...current, showMetrics: !current.showMetrics }))
  }, [])
  const openSemanticReview = useCallback(() => {
    setVisibility((current) => ({ ...current, isSemanticReviewOpen: true }))
  }, [])
  const closeSemanticReview = useCallback(() => {
    setVisibility((current) => ({ ...current, isSemanticReviewOpen: false }))
  }, [])

  return {
    ...visibility,
    openResetConfirmation,
    closeResetConfirmation,
    openRules,
    closeRules,
    openApiConfiguration,
    closeApiConfiguration,
    openFullscreen,
    closeFullscreen,
    toggleMetrics,
    openSemanticReview,
    closeSemanticReview,
  }
}
