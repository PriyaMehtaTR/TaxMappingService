import requests
import json
import logging
from openai import AzureOpenAI

# Set your workspace id
workspace_id = "AIPioneersQjQx"
model_name = "gpt-4.1"
asset_id = "208322"
OPENAI_BASE_URL = "https://eais2-use.int.thomsonreuters.com"
OPENAI_API_KEY = None

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("OpenArenaCall")

def OpenArenaCall():
    """
    Get OpenAI credentials from the Thomson Reuters AI Platform.
    
    Returns:
        dict: A dictionary containing the OpenAI credentials.
    """
    # Create a dictionary payload with workspace_id and model_name
    payload = {
        "workspace_id": workspace_id,
        "model_name": model_name,
    }
 
    # Define the URL for the request
    url = "https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token"
 
    # Send a POST request to the URL with headers and the payload
    resp = requests.post(url, headers=None, json=payload)
 
    # Load the response content as JSON
    credentials = json.loads(resp.content)
    logger.info(f"credentials: {str(credentials)}")
    return credentials

def LLMCall(query, messages=None, tools=None, tool_choice=None, temperature=0):
    """
    Call the LLM model and get the response to the user's query.
    
    Args:
        query (str): The user's query.
        messages (list, optional): List of message objects for the conversation. Defaults to None.
        tools (list, optional): List of tool objects for the LLM. Defaults to None.
        tool_choice (str, optional): Tool choice option. Defaults to None.
        temperature (float, optional): Temperature for response generation. Defaults to 0.
        
    Returns:
        The LLM response object.
    """
    credentials = OpenArenaCall()
    if "openai_key" in credentials and "openai_endpoint" in credentials:
        OPENAI_API_KEY = credentials["openai_key"]
        OPENAI_DEPLOYMENT_ID = credentials["azure_deployment"]
        OPENAI_API_VERSION = credentials["openai_api_version"]
        llm_profile_key = OPENAI_DEPLOYMENT_ID.split("/")[0]

        headers = {
            "Authorization": f"Bearer {credentials['token']}",
            "api-key": OPENAI_API_KEY,
            "Content-Type": "application/json",
            "x-tr-chat-profile-name": "ai-platforms-chatprofile-prod",
            "x-tr-userid": workspace_id,
            "x-tr-llm-profile-key": llm_profile_key,
            "x-tr-user-sensitivity": "true",
            "x-tr-sessionid": OPENAI_DEPLOYMENT_ID,
            "x-tr-asset-id": asset_id,
            "x-tr-authorization": OPENAI_BASE_URL
        }

        # Initialize the AzureOpenAI client
        client = AzureOpenAI(
            azure_endpoint=OPENAI_BASE_URL,
            api_key=OPENAI_API_KEY,
            api_version=OPENAI_API_VERSION,
            azure_deployment=OPENAI_DEPLOYMENT_ID,
            default_headers=headers,
        )

        # If messages are provided, use them; otherwise, create a new message with the query
        if not messages:
            messages = [{"role": "user", "content": query}]
        
        # Create the completion request
        completion_args = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature
        }
        
        # Add tools and tool_choice if provided
        if tools:
            completion_args["tools"] = tools
        if tool_choice:
            completion_args["tool_choice"] = tool_choice

        # Call the OpenAI API
        response = client.chat.completions.create(**completion_args)

        logger.info(f"LLM response: {response.choices[0].message.content if response.choices[0].message.content else 'Tool call response'}")
        return response
    else:
        logger.error("Failed to retrieve OpenAI credentials. Please check your inputs.")
        return None

async def aLLMCall(query, messages=None, tools=None, tool_choice=None, temperature=0):
    """
    Async wrapper for LLMCall to maintain compatibility with existing code.
    
    Args:
        query (str): The user's query.
        messages (list, optional): List of message objects for the conversation. Defaults to None.
        tools (list, optional): List of tool objects for the LLM. Defaults to None.
        tool_choice (str, optional): Tool choice option. Defaults to None.
        temperature (float, optional): Temperature for response generation. Defaults to 0.
        
    Returns:
        The LLM response object.
    """
    # This is a simple wrapper to maintain async compatibility with the existing code
    return LLMCall(query, messages, tools, tool_choice, temperature)

if __name__ == "__main__":
    # Example usage of the OpenArenaCall and LLMCall functions
    query = "What is the capital of France?"
    response = LLMCall(query)
    if response:
        print("LLM Response:", response.choices[0].message.content)
    else:
        print("Failed to get a response from the LLM.")