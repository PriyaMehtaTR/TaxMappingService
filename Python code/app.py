# ----------------------
# Imports and App Setup
# ----------------------
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from werkzeug.utils import secure_filename
from rapidfuzz import process, fuzz
import re
from const.field_keywords import FIELD_KEYWORDS
import joblib
import os

app = Flask(__name__)
CORS(app, origins=["http://localhost:8501", "*"])

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_model")
MODEL_PATH = os.path.join(MODEL_DIR, "ultra_high_accuracy_classifier.joblib")
try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    model = None
    print(f"Error loading model: {e}")

# ----------------------
# API Endpoints
# ----------------------

@app.route('/getSheetData', methods=['GET'])
def get_sheet_data():
    """
    Endpoint to get mapped sheet data for a file from an external API.
    Expects 'clientId', 'filename', and 'currentPeriod' (date range) as query parameters.
    Calls the external document stream API to fetch the file content.
    """
    import requests
    from io import BytesIO
    client_id = request.args.get('clientId')
    filename = request.args.get('filename')
    current_period = request.args.get('currentPeriod')  # e.g. '6/4/2025-5/7/2025'
    if not client_id or not filename or not current_period:
        return jsonify({'error': 'Missing clientId, filename, or currentPeriod'}), 400
    api_url = f"http://localhost:5119/api/Document/stream?clientId={client_id}&filePath={filename}"
    try:
        resp = requests.get(api_url)
        if resp.status_code != 200:
            return jsonify({'error': f'Failed to fetch file from external API: {resp.text}'}), 502
        file_stream = BytesIO(resp.content)
        result = categorize_excel_sheets_fuzzy(file_stream, current_period)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Exception occurred: {str(e)}'}), 500

@app.route('/getData', methods=['POST'])
def get_data():
    """
    Endpoint to receive an uploaded Excel file, process all sheets,
    and return mapped data for Amount, Date, Description columns.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    result = categorize_excel_sheets_fuzzy(file)
    return jsonify(result)

@app.route('/getMappedCategory', methods=['POST'])
def get_mapped_category():
    """
    Endpoint to receive an array of objects with fields: transactionDescription, id.
    Returns the same array with predicted taxCategories using the model.
    Example input:
    [
        {
            "transactionDescription": "Some description",
            "id": 123
        },
        ...
    ]
    """
    if not request.is_json:
        return jsonify({'error': 'Request body must be JSON'}), 400
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({'error': 'Input must be a list of objects'}), 400
    if model is None:
        return jsonify({'error': 'Model is not available. Please check server logs.'}), 503
    result = []
    for item in data:
        if not all(k in item for k in ['transactionDescription', 'id']):
            return jsonify({'error': 'Each object must contain transactionDescription and id'}), 400
        description_text = item['transactionDescription']
        try:
            description_to_predict = [str(description_text)]
            prediction = model.predict(description_to_predict)
            predicted_category = prediction[0]
            item['taxCategories'] = predicted_category
        except Exception as e:
            item['taxCategories'] = None
            item['error'] = f'Prediction failed: {str(e)}'
        result.append(item)
    return jsonify(result)

# ----------------------
# Utility Methods
# ----------------------
# These are helper functions for fuzzy column mapping and Excel processing.

def best_column_match(col_name, field_keywords):
    """
    Fuzzy match a column name to the best field using rapidfuzz.
    Returns the field name if a good match is found, else None.
    """
    best_field = None
    highest_score = 0
    # Preprocess the column name first
    processed_col_name = preprocess_col_name(col_name)
    for field, keywords in field_keywords.items():
        for keyword in keywords:
            score = fuzz.token_set_ratio(processed_col_name, keyword)
            if score > highest_score:
                highest_score = score
                best_field = field
    # Set a threshold to avoid false matches
    return best_field if highest_score >= 70 else None


def map_columns(df):
    """
    Map DataFrame columns to Amount, Date, Description using fuzzy matching.
    Returns mapped data and the mapping used.
    """
    mapping = {field: None for field in FIELD_KEYWORDS}
    mapping['Other'] = []
    for col in df.columns:
        field = best_column_match(col, FIELD_KEYWORDS)
        # TODO : Use open api call for non matched fields
        if field and not mapping[field]:
            mapping[field] = col
        else:
            mapping['Other'].append(col)
    mapped_data = []
    for _, row in df.iterrows():
        mapped_data.append({
            'Amount': row.get(mapping['Amount']),
            'Date': row.get(mapping['Date']),
            'Description': row.get(mapping['Description']),
            'DisallowableExpenses': row.get(mapping['DisallowableExpenses'])
        })
    return mapped_data, mapping


def categorize_excel_sheets_fuzzy(file, quarter_date_range=None):
    """
    Process all sheets in the given Excel file, mapping columns for each sheet.
    Returns a list of dicts with sheet_name, column_mapping, mapped_data, columns, and selected for each sheet.
    Skips sheets that are empty, all null, or have only header and no data.
    The 'selected' flag is True if any row in mapped_data has a Date in the specified quarter range.
    """
    print("Categorizing Excel sheets using fuzzy matching...")
    if not file:
        return {'error': 'No file provided'}, 400
    from dateutil import parser as date_parser
    # Use provided quarter_date_range or fallback to default
    QUARTER_DATE_RANGE = quarter_date_range or '6/4/2025-5/7/2025'

    def parse_quarter_range(quarter_range_str):
        start_str, end_str = quarter_range_str.split('-')
        start_date = date_parser.parse(start_str.strip(), dayfirst=True)
        end_date = date_parser.parse(end_str.strip(), dayfirst=True)
        return start_date, end_date

    start_date, end_date = parse_quarter_range(QUARTER_DATE_RANGE)
    xl = pd.ExcelFile(file)
    sheet_data_list = []
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        # Drop rows that are all null or empty strings
        df_clean = df.dropna(how='all')
        df_clean = df_clean.loc[~(df_clean.astype(str).apply(lambda x: x.str.strip()).eq('').all(axis=1))]
        # Skip if no data rows left after cleaning
        if df_clean.empty:
            continue
        if sheet_name.lower().startswith('1 row null'):
            continue
        mapped_data, mapping = map_columns(df_clean)
        # Determine if any row in mapped_data has a Date in the quarter range
        selected = False
        date_col = mapping.get('Date')
        if date_col:
            for row in mapped_data:
                row_date = row.get('Date')
                try:
                    dt = date_parser.parse(str(row_date), dayfirst=True, fuzzy=True)
                    if start_date <= dt <= end_date:
                        selected = True
                        break
                except Exception:
                    continue
        sheet_data_list.append({
            'sheet_name': sheet_name,
            'column_mapping': mapping,
            'mapped_data': mapped_data,
            'columns': list(df_clean.columns),
            'selected': selected
        })
    return {'sheet_data': sheet_data_list}


def preprocess_col_name(col_name):
    # Convert to lowercase
    col_name = str(col_name).lower()
    # Replace non-alphanumeric characters (except spaces) with spaces
    col_name = re.sub(r'[^a-z0-9\s]', ' ', col_name)
    # Remove extra spaces
    col_name = re.sub(r'\s+', ' ', col_name).strip()
    return col_name

if __name__ == '__main__':
    app.run(debug=True)
