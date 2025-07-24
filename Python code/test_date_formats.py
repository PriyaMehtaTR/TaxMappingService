import io
import pandas as pd
from app import categorize_excel_sheets_fuzzy

# Helper to create an in-memory Excel file with various UK date formats
def create_test_excel():
    # Various UK date formats
    date_formats = [
        '24/07/2025',   # dd/mm/yyyy
        '24-07-2025',   # dd-mm-yyyy
        '24 Jul 2025',  # dd MMM yyyy
        '24 July 2025', # dd MMMM yyyy
        '07/24/2025',   # mm/dd/yyyy (should not match UK, but included for robustness)
        '2025-07-24',   # yyyy-mm-dd
        '24.07.2025',   # dd.mm.yyyy
        '24/7/25',      # d/m/yy
        '24/7/2025',    # d/m/yyyy
        '24th July 2025', # ddth MMMM yyyy
        'Thursday, 24 July 2025', # Full weekday
        '24/07/25',     # dd/mm/yy
        '24/Jul/2025',  # dd/MMM/yyyy
        '24-July-2025', # dd-MMMM-yyyy
        '24-Jul-2025',  # dd-MMM-yyyy
        '2025/07/24',   # yyyy/mm/dd
        '24/07/2025 12:00', # dd/mm/yyyy HH:MM
        '',             # Empty
        None            # None
    ]
    data = {
        'Amount': [100]*len(date_formats),
        'Date': date_formats,
        'Description': [f"Test row {i+1}" for i in range(len(date_formats))],
        'DisallowableExpenses': [0]*len(date_formats)
    }
    df = pd.DataFrame(data)
    # Add a second sheet with only headers (should be skipped)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='UKDateFormats', index=False)
        pd.DataFrame(columns=['Amount', 'Date', 'Description', 'DisallowableExpenses']).to_excel(writer, sheet_name='EmptySheet', index=False)
    output.seek(0)
    return output

def test_categorize_excel_sheets_fuzzy():
    # Quarter range that should include 24/07/2025
    quarter_range = '1/7/2025-30/7/2025'
    excel_file = create_test_excel()
    result = categorize_excel_sheets_fuzzy(excel_file, quarter_range)
    print("Test result for UK date formats:")
    for sheet in result['sheet_data']:
        print(f"Sheet: {sheet['sheet_name']}, Selected: {sheet['selected']}")
        for row in sheet['mapped_data']:
            print(row)
    assert any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] == 'UKDateFormats'), "At least one row should be selected for the given quarter."
    # Check that the empty sheet is skipped
    assert not any(sheet['sheet_name'] == 'EmptySheet' for sheet in result['sheet_data']), "EmptySheet should be skipped."

# Helper to create an in-memory Excel file with various UK date formats and multiple sheets for different quarters
def create_test_excel_multi_quarter():
    # Sheet 1: Q1 (Jan-Mar 2025)
    q1_dates = ['15/01/2025', '28/02/2025', '10/03/2025']
    # Sheet 2: Q2 (Apr-Jun 2025)
    q2_dates = ['05/04/2025', '20/05/2025', '30/06/2025']
    # Sheet 3: Q3 (Jul-Sep 2025)
    q3_dates = ['01/07/2025', '15/08/2025', '30/09/2025']
    # Sheet 4: Q4 (Oct-Dec 2025)
    q4_dates = ['10/10/2025', '25/11/2025', '31/12/2025']
    # Sheet 5: Only headers (should be skipped)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame({
            'Amount': [100, 200, 300],
            'Date': q1_dates,
            'Description': ['Q1 row 1', 'Q1 row 2', 'Q1 row 3'],
            'DisallowableExpenses': [0, 0, 0]
        }).to_excel(writer, sheet_name='Q1', index=False)
        pd.DataFrame({
            'Amount': [400, 500, 600],
            'Date': q2_dates,
            'Description': ['Q2 row 1', 'Q2 row 2', 'Q2 row 3'],
            'DisallowableExpenses': [0, 0, 0]
        }).to_excel(writer, sheet_name='Q2', index=False)
        pd.DataFrame({
            'Amount': [700, 800, 900],
            'Date': q3_dates,
            'Description': ['Q3 row 1', 'Q3 row 2', 'Q3 row 3'],
            'DisallowableExpenses': [0, 0, 0]
        }).to_excel(writer, sheet_name='Q3', index=False)
        pd.DataFrame({
            'Amount': [1000, 1100, 1200],
            'Date': q4_dates,
            'Description': ['Q4 row 1', 'Q4 row 2', 'Q4 row 3'],
            'DisallowableExpenses': [0, 0, 0]
        }).to_excel(writer, sheet_name='Q4', index=False)
        pd.DataFrame(columns=['Amount', 'Date', 'Description', 'DisallowableExpenses']).to_excel(writer, sheet_name='EmptySheet', index=False)
    output.seek(0)
    return output


def test_categorize_excel_sheets_fuzzy_multi_quarter():
    # Test for Q1
    q1_range = '1/1/2025-31/3/2025'
    excel_file = create_test_excel_multi_quarter()
    result = categorize_excel_sheets_fuzzy(excel_file, q1_range)
    assert any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] == 'Q1'), "Q1 should be selected for Q1 range."
    assert not any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] != 'Q1'), "Only Q1 should be selected for Q1 range."

    # Test for Q2
    q2_range = '1/4/2025-30/6/2025'
    excel_file = create_test_excel_multi_quarter()
    result = categorize_excel_sheets_fuzzy(excel_file, q2_range)
    assert any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] == 'Q2'), "Q2 should be selected for Q2 range."
    assert not any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] != 'Q2'), "Only Q2 should be selected for Q2 range."

    # Test for Q3
    q3_range = '1/7/2025-30/9/2025'
    excel_file = create_test_excel_multi_quarter()
    result = categorize_excel_sheets_fuzzy(excel_file, q3_range)
    assert any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] == 'Q3'), "Q3 should be selected for Q3 range."
    assert not any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] != 'Q3'), "Only Q3 should be selected for Q3 range."

    # Test for Q4
    q4_range = '1/10/2025-31/12/2025'
    excel_file = create_test_excel_multi_quarter()
    result = categorize_excel_sheets_fuzzy(excel_file, q4_range)
    assert any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] == 'Q4'), "Q4 should be selected for Q4 range."
    assert not any(sheet['selected'] for sheet in result['sheet_data'] if sheet['sheet_name'] != 'Q4'), "Only Q4 should be selected for Q4 range."

    # Check that the empty sheet is skipped
    assert not any(sheet['sheet_name'] == 'EmptySheet' for sheet in result['sheet_data']), "EmptySheet should be skipped."
    print("All multi-quarter tests passed.")

if __name__ == "__main__":
    test_categorize_excel_sheets_fuzzy()
    test_categorize_excel_sheets_fuzzy_multi_quarter()
