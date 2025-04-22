import re
from typing import Dict, List, Tuple, Any
from loguru import logger
from config import INTENT_KEYWORDS, MODEL_REGISTRY

class PromptClassifier:
    """
    Analyzes prompts to determine the most appropriate LLM model.
    Currently uses a simple rule-based approach that can be extended later.
    """
    
    def __init__(self):
        self.intent_keywords = INTENT_KEYWORDS
        self.model_registry = MODEL_REGISTRY
        
    def _count_keyword_matches(self, prompt: str) -> Dict[str, int]:
        """
        Count keyword matches for each model category.
        
        Args:
            prompt: The user prompt
            
        Returns:
            Dict mapping model keys to match counts
        """
        prompt = prompt.lower()
        scores = {model_key: 0 for model_key in self.intent_keywords.keys()}
        
        # Count keyword matches for each model
        for model_key, keywords in self.intent_keywords.items():
            for keyword in keywords:
                # Use word boundary to match whole words
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = re.findall(pattern, prompt)
                scores[model_key] += len(matches)
                
        return scores
    
    def _analyze_complexity(self, prompt: str) -> Dict[str, float]:
        """
        Analyze the complexity of the prompt based on simple heuristics.
        
        Args:
            prompt: The user prompt
            
        Returns:
            Dict with complexity scores
        """
        # Simple heuristics for complexity
        complexity_scores = {
            "length": min(1.0, len(prompt) / 1000),  # Normalized length (max 1.0)
            "question_count": prompt.count("?") / max(1, len(prompt.split("."))),
            "complexity_terms": sum(1 for term in ["explain", "analyze", "compare", "why", "how"] 
                                  if term in prompt.lower()) / 5
        }
        
        return complexity_scores
    
    def _determine_final_score(self, keyword_scores: Dict[str, int], complexity: Dict[str, float]) -> Dict[str, float]:
        """
        Combine keyword matches and complexity analysis into final scores.
        
        Args:
            keyword_scores: Counts of keyword matches per model
            complexity: Complexity analysis scores
            
        Returns:
            Dict mapping model keys to final scores
        """
        final_scores = {}
        
        # Basic weighting of keyword matches and complexity
        for model_key in keyword_scores:
            # Default score from keyword matches
            score = keyword_scores[model_key]
            
            # Adjust score based on model capabilities and prompt complexity
            if model_key == "local" and complexity["length"] > 0.3:
                # Penalize local model for longer prompts
                score *= (1 - complexity["length"])
            
            elif model_key == "openai" and complexity["complexity_terms"] > 0.4:
                # Boost OpenAI for medium complexity tasks
                score += complexity["complexity_terms"] * 2
                
            elif model_key == "anthropic" and complexity["length"] > 0.5:
                # Boost Anthropic for longer prompts
                score += complexity["length"] * 3
                
            final_scores[model_key] = max(0, score)
            
        return final_scores
            
    def classify_prompt(self, prompt: str, metadata: Dict[str, Any] = None) -> Tuple[str, Dict[str, float]]:
        """
        Determine which model should process the given prompt.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata that might influence model selection
            
        Returns:
            Tuple of (selected_model_key, score_breakdown)
        """
        if metadata is None:
            metadata = {}
            
        # Step 1: Count keyword matches
        keyword_scores = self._count_keyword_matches(prompt)
        
        # Step 2: Analyze complexity
        complexity = self._analyze_complexity(prompt)
        
        # Step 3: Calculate final scores
        final_scores = self._determine_final_score(keyword_scores, complexity)
        
        # Step 4: Override based on metadata if needed
        if "priority" in metadata:
            priority = metadata["priority"]
            if priority == "speed":
                final_scores["local"] *= 1.5  # Boost local model for speed priority
            elif priority == "quality":
                final_scores["openai"] *= 1.2  # Boost OpenAI/Anthropic for quality
                final_scores["anthropic"] *= 1.2
        
        # Step 5: Select model with highest score (default to OpenAI if all scores are 0)
        if all(score == 0 for score in final_scores.values()):
            selected_model = "openai"  # Default if no clear match
            logger.info(f"No clear model match for prompt, defaulting to {selected_model}")
        else:
            selected_model = max(final_scores, key=final_scores.get)
            
        # Create breakdown for logging/debugging
        score_breakdown = {
            "keyword_matches": keyword_scores,
            "complexity": complexity,
            "final_scores": final_scores,
            "selected_model": selected_model
        }
        
        logger.info(f"Classified prompt to model: {selected_model} with score: {final_scores[selected_model]:.2f}")
        logger.debug(f"Classification breakdown: {score_breakdown}")
        
        return selected_model, score_breakdown

# Singleton instance
classifier = PromptClassifier()