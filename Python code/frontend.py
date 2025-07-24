import streamlit as st
import requests

st.title("Excel File Upload and Data Mapping")

uploaded_file = st.file_uploader("Upload Excel file", type=["xlsx"])

if uploaded_file:
    if st.button("Next"):
        files = {'file': uploaded_file.getvalue()}
        response = requests.post("http://localhost:5000/getData", files={'file': uploaded_file})
        if response.ok:
            st.json(response.json())
        else:
            st.error("API Error: " + response.text)
