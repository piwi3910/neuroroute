import argparse
import json
import requests
import time

def main():
    parser = argparse.ArgumentParser(description='Test the NeuroRoute API')
    parser.add_argument('--prompt', type=str, required=True, help='The prompt to send')
    parser.add_argument('--url', type=str, default='http://localhost:8000', help='The API URL')
    parser.add_argument('--priority', type=str, choices=['speed', 'quality'], help='Optional priority')
    parser.add_argument('--user_id', type=str, help='Optional user ID')
    args = parser.parse_args()
    
    # Prepare the request
    url = f"{args.url}/prompt"
    payload = {
        "prompt": args.prompt,
        "metadata": {}
    }
    
    if args.priority:
        payload["metadata"]["priority"] = args.priority
    
    if args.user_id:
        payload["metadata"]["user_id"] = args.user_id
    
    # Send the request
    print(f"Sending prompt: {args.prompt[:50]}...")
    start_time = time.time()
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        # Parse the response
        result = response.json()
        elapsed = time.time() - start_time
        
        # Print the results
        print("\n" + "="*50)
        print(f"Response from: {result['model_used']}")
        print(f"Total time: {elapsed:.2f}s (API reported: {result['latency_ms']/1000:.2f}s)")
        
        if result.get('from_cache', False):
            print("Response retrieved from cache!")
            
        if 'token_usage' in result and result['token_usage']:
            usage = result['token_usage']
            print(f"Token usage: {usage.get('total_tokens', 0)} total tokens")
            
        print("="*50)
        print("\nResponse:")
        print("-"*50)
        print(result['response'])
        print("-"*50)
        
        # Print classification data if available
        if 'classification' in result and result['classification']:
            print("\nClassification data:")
            print(json.dumps(result['classification'], indent=2))
            
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        
if __name__ == "__main__":
    main()