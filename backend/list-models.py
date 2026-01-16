import os
from dotenv import load_dotenv
load_dotenv('.env')

print("Listing available models...")

try:
    import google.genai as genai
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        client = genai.Client(api_key=api_key)
        
        # List available models
        models = client.models.list()
        print("Available models:")
        for model in models:
            print(f"  - {model.name}: {model.display_name}")
            if hasattr(model, 'supported_generation_methods'):
                print(f"    Supported methods: {model.supported_generation_methods}")
    else:
        print("No API key found")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()