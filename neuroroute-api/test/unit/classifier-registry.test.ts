import { describe, it, expect, beforeEach } from '../../test/jest-setup.js';
import { createClassifierRegistry } from '../../src/services/classifier/registry.js';
import { createRulesBasedClassifier } from '../../src/services/classifier/classifiers/rules-based.js';
import { createMlBasedClassifier } from '../../src/services/classifier/classifiers/ml-based.js';
import { ClassifierRegistry } from '../../src/services/classifier/interfaces.js';

describe('Classifier Registry', () => {
  let registry: ClassifierRegistry;
  
  beforeEach(() => {
    registry = createClassifierRegistry();
  });
  
  it('should create an empty registry', () => {
    expect(registry).toBeDefined();
    expect(registry.getAll()).toEqual([]);
    expect(() => registry.getDefault()).toThrow();
  });
  
  it('should register a classifier', () => {
    const classifier = createRulesBasedClassifier();
    registry.register(classifier);
    
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getAll()[0]).toBe(classifier);
  });
  
  it('should set and get the default classifier', () => {
    const classifier = createRulesBasedClassifier();
    registry.register(classifier);
    registry.setDefault(classifier.name);
    
    expect(registry.getDefault()).toBe(classifier);
  });
  
  it('should throw an error when setting a non-existent classifier as default', () => {
    expect(() => registry.setDefault('non-existent')).toThrow();
  });
  
  it('should get a classifier by name', () => {
    const classifier = createRulesBasedClassifier();
    registry.register(classifier);
    
    expect(registry.get(classifier.name)).toBe(classifier);
  });
  
  it('should return undefined when getting a non-existent classifier', () => {
    expect(registry.get('non-existent')).toBeUndefined();
  });
  
  it('should register multiple classifiers', () => {
    const rulesBasedClassifier = createRulesBasedClassifier();
    const mlBasedClassifier = createMlBasedClassifier();
    
    registry.register(rulesBasedClassifier);
    registry.register(mlBasedClassifier);
    
    expect(registry.getAll()).toHaveLength(2);
    expect(registry.get(rulesBasedClassifier.name)).toBe(rulesBasedClassifier);
    expect(registry.get(mlBasedClassifier.name)).toBe(mlBasedClassifier);
  });
  
  it('should not register a classifier with a duplicate name', () => {
    const classifier1 = createRulesBasedClassifier();
    const classifier2 = createRulesBasedClassifier();
    
    registry.register(classifier1);
    expect(() => registry.register(classifier2)).toThrow();
  });
});