from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional, Union
import joblib
import os
import socket

# --- Utility Functions ---
def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        # Connect to a remote address to get the local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
        return local_ip
    except Exception:
        return "127.0.0.1"


# --- Model Loading ---
MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_model")
MODEL_PATH = os.path.join(MODEL_DIR, "ultra_high_accuracy_classifier.joblib")
model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage the application lifespan events.
    Load the model on startup and clean up on shutdown.
    """
    # Startup
    global model
    try:
        model = joblib.load(MODEL_PATH)
        print("Model loaded successfully.")
        
        # Print network access information
        local_ip = get_local_ip()
        print(f"\n🌐 API Server Information:")
        print(f"   Local access: http://127.0.0.1:8000")
        print(f"   Network access: http://{local_ip}:8000")
        print(f"   Web Interface: http://{local_ip}:8000/web")
        print(f"   API Documentation: http://{local_ip}:8000/docs")
        print(f"\n   Share the network URL with other users on your network!")
        
    except FileNotFoundError:
        print(f"Error: Model file not found at {MODEL_PATH}")
        model = None  # Ensure model is None if loading fails
    except Exception as e:
        print(f"An error occurred while loading the model: {e}")
        model = None
    
    yield
    
    # Shutdown (cleanup if needed)
    print("Application shutting down...")


# --- Application Setup ---
app = FastAPI(
    title="Tax Category Classifier API",
    description="An API to predict the category based on its description.",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware to allow requests from the HTML file
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# --- Pydantic Models for Request and Response ---
class PredictionRequest(BaseModel):
    """Defines the structure for the prediction request body."""
    description: str


class PredictionResponse(BaseModel):
    """Defines the structure for the prediction response body."""
    category: str


class BulkPredictionRequest(BaseModel):
    """Defines the structure for bulk prediction request."""
    data: List[Dict[str, Any]] = Field(..., description="List of transaction records")
    description_column: str = Field(
        default="Description", 
        description="Name of the column containing transaction descriptions (e.g., 'Description' or 'Transaction Description')"
    )


class BulkPredictionResponse(BaseModel):
    """Defines the structure for bulk prediction response."""
    data: List[Dict[str, Any]] = Field(..., description="Original data with added category_mapped column")
    processed_count: int = Field(..., description="Number of records processed")
    success_count: int = Field(..., description="Number of successful predictions")
    error_count: int = Field(..., description="Number of failed predictions")
    errors: List[Dict[str, Union[int, str]]] = Field(..., description="Details of any errors encountered")


# --- API Endpoints ---
@app.get("/", tags=["General"])
def read_root():
    """A simple endpoint to check if the API is running."""
    return {"message": "Welcome to the Product Category Classifier API!"}


@app.get("/web", response_class=HTMLResponse, tags=["Web Interface"])
def get_web_interface():
    """
    Serves the HTML web interface for the API.
    This provides a user-friendly interface to test the API endpoints.
    """
    try:
        # Read the HTML file
        html_file_path = os.path.join(os.path.dirname(__file__), "enhanced_client.html")
        with open(html_file_path, "r", encoding="utf-8") as file:
            html_content = file.read()
        
        # Get the current server IP for dynamic API endpoint configuration
        local_ip = get_local_ip()
        
        # Replace localhost references with current IP in the HTML
        html_content = html_content.replace(
            "http://127.0.0.1:8000", 
            f"http://10.189.218.126:8000"
        )
        html_content = html_content.replace(
            "http://localhost:8000", 
            f"http://10.189.218.126:8000"
        )
        # Remove any other IP references (e.g., old IPs)
        html_content = html_content.replace(
            "http://10.189.218.126:8000", 
            f"http://10.189.218.126:8000"
        )
        
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        return HTMLResponse(
            content="""
            <html>
                <head><title>Web Interface Not Found</title></head>
                <body>
                    <h1>Web Interface Not Available</h1>
                    <p>The HTML file 'enhanced_client.html' was not found.</p>
                    <p>Please make sure the file exists in the same directory as main.py</p>
                    <p><a href="/docs">Go to API Documentation</a></p>
                </body>
            </html>
            """,
            status_code=404
        )
    except Exception as e:
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Error Loading Web Interface</title></head>
                <body>
                    <h1>Error Loading Web Interface</h1>
                    <p>An error occurred: {str(e)}</p>
                    <p><a href="/docs">Go to API Documentation</a></p>
                </body>
            </html>
            """,
            status_code=500
        )


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict_category(request: PredictionRequest):
    """
    Predicts the product category based on its description.

    - **description**: The text description of the product.
    - **returns**: The predicted category for the product.
    """
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not available. Please check server logs."
        )

    if not request.description.strip():
        raise HTTPException(
            status_code=400,
            detail="Description cannot be empty."
        )

    # The model expects a list or iterable of texts
    description_to_predict = [request.description]

    # Predict using the loaded model
    try:
        prediction = model.predict(description_to_predict)
        predicted_category = prediction[0]
        return PredictionResponse(category=predicted_category)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during prediction: {e}"
        )


@app.post("/predict_bulk", response_model=BulkPredictionResponse, tags=["Prediction"])
def predict_bulk_categories(request: BulkPredictionRequest):
    """
    Predicts categories for multiple transactions in JSON format.
    
    - **data**: List of transaction records (JSON objects)
    - **description_column**: Name of the column containing descriptions (configurable)
    - **returns**: Original data with added 'category_mapped' column
    
    The endpoint will look for either 'Description' or 'Transaction Description' column
    (or any custom column name specified) and add predictions to 'category_mapped' column.
    """
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not available. Please check server logs."
        )
    
    if not request.data:
        raise HTTPException(
            status_code=400,
            detail="Data list cannot be empty."
        )
    
    # Process the data
    processed_data = []
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, record in enumerate(request.data):
        try:
            # Create a copy of the original record
            processed_record = record.copy()
            
            # Look for the description column (case-insensitive search)
            description_text = None
            description_key = None
            
            # First, try exact match
            if request.description_column in record:
                description_text = record[request.description_column]
                description_key = request.description_column
            else:
                # Try case-insensitive search
                for key in record.keys():
                    if key.lower() == request.description_column.lower():
                        description_text = record[key]
                        description_key = key
                        break
                
                # If still not found, try common variations
                if description_text is None:
                    common_variations = [
                        'description', 'Description', 'DESCRIPTION',
                        'transaction description', 'Transaction Description', 'TRANSACTION DESCRIPTION',
                        'transaction_description', 'Transaction_Description',
                        'desc', 'Desc', 'DESC'
                    ]
                    
                    for variation in common_variations:
                        if variation in record:
                            description_text = record[variation]
                            description_key = variation
                            break
            
            if description_text is None:
                error_count += 1
                errors.append({
                    "index": idx,
                    "error": f"Description column '{request.description_column}' not found in record. Available columns: {list(record.keys())}"
                })
                # Add the record anyway but with empty category
                processed_record['category_mapped'] = None
                processed_data.append(processed_record)
                continue
            
            # Validate description is not empty
            if not str(description_text).strip():
                error_count += 1
                errors.append({
                    "index": idx,
                    "error": "Description is empty or whitespace"
                })
                processed_record['category_mapped'] = None
                processed_data.append(processed_record)
                continue
            
            # Make prediction
            description_to_predict = [str(description_text)]
            prediction = model.predict(description_to_predict)
            predicted_category = prediction[0]
            
            # Add the predicted category to the record
            processed_record['category_mapped'] = predicted_category
            processed_data.append(processed_record)
            success_count += 1
            
        except Exception as e:
            error_count += 1
            errors.append({
                "index": idx,
                "error": f"Prediction failed: {str(e)}"
            })
            # Add the record anyway but with empty category
            processed_record = record.copy()
            processed_record['category_mapped'] = None
            processed_data.append(processed_record)
    
    return BulkPredictionResponse(
        data=processed_data,
        processed_count=len(request.data),
        success_count=success_count,
        error_count=error_count,
        errors=errors
    )


# --- Server Startup ---
if __name__ == "__main__":
    import uvicorn
    
    # Get local IP for network access
    local_ip = get_local_ip()
    
    print("🚀 Starting Product Category Classifier API Server...")
    print(f"   Server will be accessible from any device on your network!")
    
    # Run the server with network access
    uvicorn.run(
        "main:app",
        host="0.0.0.0",  # This allows access from any IP on the network
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )