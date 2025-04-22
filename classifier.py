import re
import math
import time
import json
from typing import Dict, List, Tuple, Any, Optional, Set, Callable, Union, AsyncGenerator
from functools import lru_cache
from config import INTENT_KEYWORDS, get_model_registry, get_settings, Settings, ModelCapability
from utils.logger import get_logger

logger = get_logger()

class PromptClassifier:
    """
    Analyzes prompts to determine the most appropriate LLM model.
    This classifier uses a combination of rule-based approaches and
    heuristics to select the most appropriate model for a given prompt.
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        """
        Initialize the classifier with intent keywords and model registry.
        
        Args:
            settings: Application settings. If None, will use get_settings()
        """
        # Use provided settings or get from default
        self.settings = settings or get_settings()
        self.intent_keywords = INTENT_KEYWORDS
        self.model_registry = get_model_registry(self.settings)
        
        # Add model capabilities map for easier lookup
        self.model_capabilities = {
            model_key: model_config.get("capabilities", [])
            for model_key, model_config in self.model_registry.items()
        }
        
        # Cache for recent classifications to avoid redundant processing
        self.classification_cache = {}
        self.cache_ttl = 300  # 5 minutes in seconds
        
        # Advanced pattern matching - compile regexes once for efficiency
        self._compile_patterns()
        
        # Initialize feature extractors
        self._initialize_feature_extractors()
        
        logger.info("Prompt classifier initialized with enhanced capabilities")
    
    def _compile_patterns(self):
        """Compile regex patterns for efficient matching."""
        self.patterns = {}
        for model_key, keywords in self.intent_keywords.items():
            self.patterns[model_key] = [
                re.compile(r'\b' + re.escape(keyword) + r'\b', re.IGNORECASE) 
                for keyword in keywords
            ]
            
        # Compile additional patterns for feature extraction
        self.code_pattern = re.compile(r'```[\w]*\n[\s\S]*?\n```|`[^`]+`|\bfunction\b|\bclass\b|\bdef\b')
        self.instruction_pattern = re.compile(r'\b(create|make|generate|build|implement|write|develop)\b', re.IGNORECASE)
        self.analysis_pattern = re.compile(r'\b(analyze|examine|investigate|evaluate|assess|research)\b', re.IGNORECASE)
        self.question_pattern = re.compile(r'\bwhy\b|\bhow\b|\bwhat\b|\bwhen\b|\bwhere\b|\bwhich\b|\bwho\b|\bwhose\b', re.IGNORECASE)
        
        # Compile capability-specific patterns
        self.capability_patterns = {
            ModelCapability.CODE_GENERATION: re.compile(r'\b(code|program|function|algorithm|class|method|library|api|module)\b', re.IGNORECASE),
            ModelCapability.REASONING: re.compile(r'\b(reason|logic|infer|deduce|conclude|why|because|therefore)\b', re.IGNORECASE),
            ModelCapability.SUMMARIZATION: re.compile(r'\b(summarize|summary|overview|brief|condense|digest|synopsis)\b', re.IGNORECASE),
            ModelCapability.CREATIVE_WRITING: re.compile(r'\b(creative|story|fiction|narrative|poem|essay|write|describe)\b', re.IGNORECASE),
            ModelCapability.DATA_ANALYSIS: re.compile(r'\b(data|analysis|statistics|trend|metric|chart|graph|analyze)\b', re.IGNORECASE),
            ModelCapability.SYSTEM_DESIGN: re.compile(r'\b(design|system|architecture|component|structure|framework|diagram)\b', re.IGNORECASE),
            ModelCapability.LONG_CONTEXT: re.compile(r'\b(document|long|lengthy|comprehensive|detailed|extensive|thorough)\b', re.IGNORECASE),
            ModelCapability.FUNCTION_CALLING: re.compile(r'\b(api|function|call|invoke|execute|run|trigger|action)\b', re.IGNORECASE),
            ModelCapability.LEGAL_ANALYSIS: re.compile(r'\b(legal|law|contract|agreement|terms|clause|provision|rights|obligations)\b', re.IGNORECASE),
            ModelCapability.SCIENTIFIC_KNOWLEDGE: re.compile(r'\b(science|scientific|research|experiment|theory|hypothesis|formula|equation)\b', re.IGNORECASE),
        }
    
    def _initialize_feature_extractors(self):
        """Initialize feature extractors for prompt analysis."""
        self.feature_extractors = {
            # Basic features
            "length": lambda prompt: min(1.0, len(prompt) / 2000),  # Normalized length (max 1.0)
            "word_count": lambda prompt: min(1.0, len(prompt.split()) / 300),  # Normalized word count
            "sentence_count": lambda prompt: min(1.0, prompt.count(".") / 20),  # Sentence count
            "question_count": lambda prompt: min(1.0, prompt.count("?") / 5),  # Question count
            
            # Content type features
            "code_presence": lambda prompt: 1.0 if self.code_pattern.search(prompt) else 0.0,
            "code_snippet_count": lambda prompt: min(1.0, len(re.findall(r'```[\w]*\n[\s\S]*?\n```', prompt)) / 3),
            "math_presence": lambda prompt: 1.0 if any(x in prompt for x in ["+", "-", "*", "/", "=", "<", ">"]) else 0.0,
            
            # Task type features
            "is_instruction": lambda prompt: 1.0 if self.instruction_pattern.search(prompt) else 0.0,
            "is_analysis": lambda prompt: 1.0 if self.analysis_pattern.search(prompt) else 0.0,
            "is_question": lambda prompt: 1.0 if self.question_pattern.search(prompt) else 0.0,
            
            # Complexity features
            "complexity_terms": lambda prompt: min(1.0, sum(1 for term in [
                "explain", "analyze", "compare", "contrast", "evaluate", "synthesize", 
                "examine", "investigate", "discuss", "elaborate"
            ] if re.search(r'\b' + term + r'\b', prompt.lower())) / 5),
            
            # Advanced features - these use specialized functions for calculation
            "avg_word_length": lambda prompt: self._avg_word_length(prompt),
            "vocabulary_diversity": lambda prompt: self._vocabulary_diversity(prompt),
            
            # Capability-specific features
            "capability_match": lambda prompt: self._match_capabilities(prompt),
        }
    
    def _avg_word_length(self, text: str) -> float:
        """Calculate the average word length as a complexity indicator."""
        words = re.findall(r'\b\w+\b', text.lower())
        if not words:
            return 0.0
        avg_len = sum(len(word) for word in words) / len(words)
        # Normalize: most English words average 4-5 chars, so normalize around that
        return min(1.0, avg_len / 8.0)
    
    def _vocabulary_diversity(self, text: str) -> float:
        """Estimate vocabulary diversity based on unique words ratio."""
        words = re.findall(r'\b\w+\b', text.lower())
        if not words:
            return 0.0
        # Diversity is ratio of unique words to total words, normalized
        return min(1.0, len(set(words)) / (len(words) ** 0.7))  # Power 0.7 helps with scaling
    
    def _match_capabilities(self, prompt: str) -> Dict[str, float]:
        """
        Match prompt against capability-specific patterns.
        
        Args:
            prompt: The user prompt
            
        Returns:
            Dict mapping capabilities to match scores
        """
        capability_scores = {}
        
        for capability, pattern in self.capability_patterns.items():
            matches = pattern.findall(prompt)
            # Score is normalized count of matches
            capability_scores[capability] = min(1.0, len(matches) / 5)
            
        return capability_scores
    
    def _count_keyword_matches(self, prompt: str) -> Dict[str, int]:
        """
        Count keyword matches for each model category using compiled regex patterns.
        
        Args:
            prompt: The user prompt
            
        Returns:
            Dict mapping model keys to match counts
        """
        scores = {model_key: 0 for model_key in self.intent_keywords.keys()}
        
        # Count matches using pre-compiled patterns
        for model_key, patterns in self.patterns.items():
            for pattern in patterns:
                matches = pattern.findall(prompt)
                scores[model_key] += len(matches)
                
        return scores
    
    def _extract_features(self, prompt: str) -> Dict[str, Any]:
        """
        Extract features from the prompt for detailed analysis.
        
        Args:
            prompt: The user prompt
            
        Returns:
            Dict with extracted feature values
        """
        features = {}
        
        # Apply all feature extractors
        for feature_name, extractor_func in self.feature_extractors.items():
            try:
                if feature_name == "capability_match":
                    # This returns a dict, not a single value
                    capability_scores = extractor_func(prompt)
                    for capability, score in capability_scores.items():
                        features[f"capability_{capability}"] = score
                else:
                    features[feature_name] = extractor_func(prompt)
            except Exception as e:
                logger.warning(f"Error extracting feature '{feature_name}': {e}")
                features[feature_name] = 0.0
                
        return features
    
    def _determine_final_score(self, 
                               keyword_scores: Dict[str, int], 
                               features: Dict[str, Any]) -> Dict[str, float]:
        """
        Combine keyword matches and extracted features into final scores.
        
        Args:
            keyword_scores: Counts of keyword matches per model
            features: Extracted feature values
            
        Returns:
            Dict mapping model keys to final scores
        """
        final_scores = {}
        
        # Convert keyword scores to base scores (starting point)
        base_scores = {k: v * 0.5 for k, v in keyword_scores.items()}  # Weight keywords at 50%
        
        # Initialize final scores with base scores
        final_scores = base_scores.copy()
        
        # --- Apply capability-based scoring ---
        for model_key, model_config in self.model_registry.items():
            # Get model capabilities and priorities
            capabilities = model_config.get("capabilities", [])
            priority = model_config.get("priority", {"speed": 2, "cost": 2, "quality": 2})
            
            # Initialize score boost based on priority values (1=high, 3=low)
            capability_boost = 0.0
            
            # Check each capability against feature scores
            for capability in capabilities:
                cap_feature = f"capability_{capability}"
                
                if cap_feature in features and features[cap_feature] > 0:
                    # Apply higher weights for capabilities that match the prompt
                    feature_score = features[cap_feature]
                    # Weight the capability boost by the model's capability effectiveness
                    capability_boost += feature_score * 2.0
            
            # Apply capability boost
            if capability_boost > 0:
                final_scores[model_key] += capability_boost
        
        # --- Apply model-specific heuristics ---
        
        # Local model (good for: quick tasks, simple queries, basic math, short responses)
        if "local" in final_scores:
            # Boost for simple queries and short expected responses
            if features["length"] < 0.2 and features["complexity_terms"] < 0.3:
                final_scores["local"] += 2.0
                
            # Boost for basic math operations
            if features["math_presence"] > 0 and features["code_presence"] == 0:
                final_scores["local"] += 1.5
                
            # Penalty for long or complex prompts
            if features["length"] > 0.3 or features["complexity_terms"] > 0.4:
                final_scores["local"] *= max(0.1, 1.0 - features["length"] - features["complexity_terms"])
                
            # Severe penalty for code generation tasks
            if features["code_presence"] > 0.5 or features["code_snippet_count"] > 0:
                final_scores["local"] *= 0.3
        
        # OpenAI model (good for: code, medium complexity tasks, technical analysis)
        if "openai" in final_scores:
            # Strong boost for code-related tasks
            if features["code_presence"] > 0:
                final_scores["openai"] += 3.0 * features["code_presence"]
                
            # Boost for analysis tasks
            if features["is_analysis"] > 0:
                final_scores["openai"] += 2.0 * features["is_analysis"]
                
            # Moderate boost for medium complexity or technical tasks
            if 0.3 < features["complexity_terms"] < 0.7:
                final_scores["openai"] += 1.5 * features["complexity_terms"]
                
            # Small penalty for very long documents
            if features["length"] > 0.8:
                final_scores["openai"] *= 0.9
        
        # Anthropic model (good for: long documents, high complexity, detailed reasoning)
        if "anthropic" in final_scores:
            # Strong boost for long, complex tasks
            if features["length"] > 0.5:
                final_scores["anthropic"] += 2.0 * features["length"]
                
            # Boost for high complexity content
            if features["complexity_terms"] > 0.6:
                final_scores["anthropic"] += 2.5 * features["complexity_terms"]
                
            # Boost for tasks requiring deep reasoning
            if features["is_analysis"] > 0.5 and features["avg_word_length"] > 0.6:
                final_scores["anthropic"] += 2.0
                
            # Moderate boost for extensive Q&A
            if features["question_count"] > 0.5:
                final_scores["anthropic"] += 1.0 * features["question_count"]
                
            # Small penalty for code generation (OpenAI might be better)
            if features["code_presence"] > 0.7:
                final_scores["anthropic"] *= 0.9
        
        # Ensure all scores are non-negative
        final_scores = {k: max(0.1, v) for k, v in final_scores.items()}
            
        return final_scores
    
    def _apply_metadata_adjustments(self, 
                                   scores: Dict[str, float], 
                                   metadata: Dict[str, Any]) -> Dict[str, float]:
        """
        Apply adjustments to scores based on request metadata.
        
        Args:
            scores: Current model scores
            metadata: Request metadata with priority info
            
        Returns:
            Adjusted scores dict
        """
        adjusted_scores = scores.copy()
        
        # Check for force model in metadata (early return if found)
        if "model" in metadata:
            requested_model = metadata["model"]
            if requested_model in self.model_registry:
                # Return only the requested model with a perfect score
                return {model: (10.0 if model == requested_model else 0.1) for model in adjusted_scores}
        
        # Apply priority-based adjustments
        if "priority" in metadata:
            priority = metadata["priority"].lower()
            
            if priority == "speed":
                # For speed priority, favor models with better speed priority values
                for model_key in adjusted_scores:
                    speed_priority = self.model_registry[model_key].get("priority", {}).get("speed", 2)
                    # Convert priority (1=high, 3=low) to a boost factor
                    speed_factor = 3.0 if speed_priority == 1 else (1.5 if speed_priority == 2 else 0.7)
                    adjusted_scores[model_key] *= speed_factor
                    
            elif priority == "quality":
                # For quality priority, favor models with better quality priority values
                for model_key in adjusted_scores:
                    quality_priority = self.model_registry[model_key].get("priority", {}).get("quality", 2)
                    # Convert priority (1=high, 3=low) to a boost factor
                    quality_factor = 3.0 if quality_priority == 1 else (1.5 if quality_priority == 2 else 0.7)
                    adjusted_scores[model_key] *= quality_factor
                    
            elif priority == "cost":
                # For cost priority, favor models with better cost priority values
                for model_key in adjusted_scores:
                    cost_priority = self.model_registry[model_key].get("priority", {}).get("cost", 2)
                    # Convert priority (1=high, 3=low) to a boost factor
                    cost_factor = 3.0 if cost_priority == 1 else (1.5 if cost_priority == 2 else 0.7)
                    adjusted_scores[model_key] *= cost_factor
        
        # Check for token constraints in metadata
        if "max_tokens" in metadata:
            max_tokens = metadata["max_tokens"]
            for model_key in adjusted_scores:
                model_max_tokens = self.model_registry[model_key].get("max_tokens", 4096)
                if max_tokens > model_max_tokens:
                    # If user requested more tokens than model supports, reduce score
                    adjusted_scores[model_key] *= 0.5
        
        # Check for capability requirements in metadata
        if "required_capabilities" in metadata and isinstance(metadata["required_capabilities"], list):
            for capability in metadata["required_capabilities"]:
                for model_key in adjusted_scores:
                    model_capabilities = self.model_capabilities.get(model_key, [])
                    # If model doesn't have required capability, heavily penalize
                    if capability not in model_capabilities:
                        adjusted_scores[model_key] *= 0.2
        
        # Apply user_id based adjustments if needed
        if "user_id" in metadata:
            # Here we could apply user-specific preferences or limits
            # For example, limiting expensive models for certain users
            pass
            
        return adjusted_scores
    
    def _check_cache(self, prompt: str, metadata: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Check if we have a cached classification for similar prompt and metadata.
        
        Args:
            prompt: The user prompt
            metadata: Request metadata
            
        Returns:
            Cached classification result or None if not found
        """
        # Simple cache key - this could be enhanced with similarity hashing
        cache_key = self._generate_cache_key(prompt, metadata)
        
        if cache_key in self.classification_cache:
            entry = self.classification_cache[cache_key]
            timestamp, result = entry
            
            # Check if cache entry is still valid
            if time.time() - timestamp < self.cache_ttl:
                logger.debug(f"Using cached classification for prompt")
                return result
            
            # Remove expired entry
            del self.classification_cache[cache_key]
            
        return None
    
    def _generate_cache_key(self, prompt: str, metadata: Dict[str, Any]) -> str:
        """
        Generate a cache key for a prompt and metadata.
        
        Args:
            prompt: The user prompt
            metadata: Request metadata
            
        Returns:
            Cache key string
        """
        # Extract only relevant metadata fields for caching
        relevant_metadata = {}
        
        if metadata:
            for key in ["priority", "model", "required_capabilities", "max_tokens"]:
                if key in metadata:
                    relevant_metadata[key] = metadata[key]
        
        # Create a combined string for hashing
        combined = prompt[:100]  # Use first 100 chars of prompt
        
        if relevant_metadata:
            combined += json.dumps(relevant_metadata, sort_keys=True)
            
        # Return hash of combined string
        return str(hash(combined))
    
    async def classify_prompt_async(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Tuple[str, Dict[str, Any]]:
        """
        Asynchronous version of classify_prompt for consistency with other async components.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata that might influence model selection
            
        Returns:
            Tuple of (selected_model_key, classification_info)
        """
        # This is a light wrapper around the sync method for now,
        # but could be enhanced with async-specific optimizations later
        return self.classify_prompt(prompt, metadata)
    
    def classify_prompt(self, prompt: str, metadata: Optional[Dict[str, Any]] = None) -> Tuple[str, Dict[str, Any]]:
        """
        Determine which model should process the given prompt.
        
        Args:
            prompt: The user prompt
            metadata: Optional metadata that might influence model selection
            
        Returns:
            Tuple of (selected_model_key, classification_info)
        """
        if metadata is None:
            metadata = {}
            
        # Check cache first
        cached_result = self._check_cache(prompt, metadata)
        if cached_result:
            selected_model, classification_info = cached_result
            # Add cache info
            classification_info["source"] = "cache"
            return selected_model, classification_info
        
        # Allow direct model override through metadata
        if metadata and "model" in metadata:
            requested_model = metadata["model"]
            if requested_model in self.model_registry:
                logger.info(f"Using user-specified model: {requested_model}")
                
                # Create classification info for forced model
                classification_info = {
                    "selected_model": requested_model, 
                    "source": "metadata_override",
                    "confidence": 1.0,
                    "reasoning": {"override": True}
                }
                
                # Cache the result
                cache_key = self._generate_cache_key(prompt, metadata)
                self.classification_cache[cache_key] = (time.time(), (requested_model, classification_info))
                
                return requested_model, classification_info
            else:
                logger.warning(f"User requested unknown model: {requested_model}, falling back to classification")
        
        # --- Classification pipeline ---
        
        # Step 1: Count keyword matches
        keyword_scores = self._count_keyword_matches(prompt)
        
        # Step 2: Extract detailed features
        features = self._extract_features(prompt)
        
        # Step 3: Calculate model scores
        model_scores = self._determine_final_score(keyword_scores, features)
        
        # Step 4: Apply metadata-based adjustments
        adjusted_scores = self._apply_metadata_adjustments(model_scores, metadata)
        
        # Step 5: Select model with highest score
        if all(score == 0 for score in adjusted_scores.values()):
            selected_model = "openai"  # Default fallback if all scores are 0
            confidence = 0.5  # Medium confidence for default
            logger.info(f"No clear model match for prompt, defaulting to {selected_model}")
        else:
            selected_model = max(adjusted_scores, key=adjusted_scores.get)
            
            # Calculate confidence as normalized score
            total_score = sum(adjusted_scores.values())
            confidence = adjusted_scores[selected_model] / total_score if total_score > 0 else 0.5
            
        # Create classification info for returning and logging
        classification_info = {
            "selected_model": selected_model,
            "confidence": round(confidence, 3),
            "source": "rule_based",
            "reasoning": {
                "keyword_matches": keyword_scores,
                "features": {k: v for k, v in features.items() if not isinstance(v, dict)},  # Flatten features for logging
                "model_scores": model_scores,
                "adjusted_scores": adjusted_scores,
            }
        }
        
        logger.info(f"Classified prompt to model: {selected_model} with confidence: {confidence:.3f}")
        logger.debug(f"Classification details: {classification_info}")
        
        # Cache the result
        cache_key = self._generate_cache_key(prompt, metadata)
        self.classification_cache[cache_key] = (time.time(), (selected_model, classification_info))
        
        return selected_model, classification_info


# Factory function with caching for better performance
@lru_cache()
def get_classifier(settings: Optional[Settings] = None) -> PromptClassifier:
    """
    Factory function to create or return cached PromptClassifier instance.
    This integrates well with FastAPI dependency injection.
    
    Args:
        settings: Optional settings to initialize classifier with
        
    Returns:
        PromptClassifier instance
    """
    return PromptClassifier(settings)