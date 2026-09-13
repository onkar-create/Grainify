"""Streamlit dashboard for Grainify: pick a drought scenario, see optimized vs baseline allocation."""
import os
import sys

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.config import SCENARIOS
from src.simulation import run_scenario

st.set_page_config(page_title="Grainify", layout="wide")

st.title("Grainify")
st.caption(
    "AI-assisted decision support for optimizing food grain distribution through India's PDS "
    "during El Niño-induced scarcity."
)

scenario_name = st.sidebar.selectbox("Scenario", list(SCENARIOS.keys()), index=2)
run_clicked = st.sidebar.button("Run optimization", type="primary")

if "result" not in st.session_state or run_clicked:
    with st.spinner("Forecasting demand and solving the allocation network..."):
        st.session_state["result"] = run_scenario(scenario_name)

result = st.session_state["result"]

col1, col2, col3, col4 = st.columns(4)
col1.metric("Total predicted demand", f"{sum(result['demand'].values()):,.0f} t")
col2.metric("Total warehouse supply", f"{sum(result['supply'].values()):,.0f} t")
col3.metric("Cost reduction vs baseline", f"{result['cost_savings_pct']:.1f}%")
col4.metric("Unmet demand reduction", f"{result['unmet_reduction_pct']:.1f}%")

st.divider()

left, right = st.columns(2)
with left:
    st.subheader("Total cost (Rs)")
    fig = go.Figure(go.Bar(
        x=["Baseline (proportional)", "Optimized (Min-Cost Max-Flow)"],
        y=[result["baseline"]["total_cost"], result["optimized"]["total_cost"]],
        marker_color=["#94a3b8", "#2563eb"],
    ))
    st.plotly_chart(fig, use_container_width=True)

with right:
    st.subheader("Total unmet demand (tonnes)")
    fig = go.Figure(go.Bar(
        x=["Baseline (proportional)", "Optimized (Min-Cost Max-Flow)"],
        y=[result["baseline"]["total_unmet"], result["optimized"]["total_unmet"]],
        marker_color=["#94a3b8", "#16a34a"],
    ))
    st.plotly_chart(fig, use_container_width=True)

st.divider()
st.subheader("District-level allocation")

districts = list(result["demand"].keys())
table = pd.DataFrame({
    "District": districts,
    "Predicted demand (t)": [round(result["demand"][d], 0) for d in districts],
    "Baseline allocation (t)": [round(result["baseline"]["allocation"][d], 0) for d in districts],
    "Baseline unmet (t)": [round(result["baseline"]["unmet"][d], 0) for d in districts],
    "Optimized allocation (t)": [round(result["optimized"]["allocation"][d], 0) for d in districts],
    "Optimized unmet (t)": [round(result["optimized"]["unmet"][d], 0) for d in districts],
})
st.dataframe(table, use_container_width=True, hide_index=True)

fig = go.Figure()
fig.add_trace(go.Bar(name="Predicted demand", x=table["District"], y=table["Predicted demand (t)"], marker_color="#e2e8f0"))
fig.add_trace(go.Bar(name="Baseline allocation", x=table["District"], y=table["Baseline allocation (t)"], marker_color="#94a3b8"))
fig.add_trace(go.Bar(name="Optimized allocation", x=table["District"], y=table["Optimized allocation (t)"], marker_color="#2563eb"))
fig.update_layout(barmode="group", xaxis_tickangle=-45, height=500)
st.plotly_chart(fig, use_container_width=True)
