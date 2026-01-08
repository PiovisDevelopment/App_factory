import asyncio
import sys
from unittest.mock import MagicMock, patch

# Add src to path
sys.path.append("src")
sys.path.append(".")

from services.ai_team.orchestrator import run_workflow_api


async def test_graph_execution():
    print("--- Starting Dry Run Verification ---")

    # Mock the individual agent creations
    with patch("services.ai_team.orchestrator.create_research_agent") as mock_research, \
         patch("services.ai_team.orchestrator.create_designer_agent") as mock_design, \
         patch("services.ai_team.orchestrator.create_developer_agent") as mock_dev, \
         patch("services.ai_team.orchestrator.create_qa_agent") as mock_qa:

        # Setup the "Agent" mock that has an async run method
        mock_agent_instance = MagicMock()

        # The .run() method must be awaitable and return a result with .data
        mock_node_result = MagicMock()
        mock_node_result.data = "Mocked Result"

        # Create a future for the run() call result
        run_future = asyncio.Future()
        run_future.set_result(mock_node_result)
        mock_agent_instance.run.return_value = run_future

        # -- Sync Factories (Research, Design, QA) --
        mock_research.return_value = mock_agent_instance
        mock_design.return_value = mock_agent_instance
        mock_qa.return_value = mock_agent_instance

        # -- Async Factory (Developer) --
        # create_developer_agent is async, so calling it returns a coroutine/future
        # We need the patch to return a Future that resolves to the agent instance
        dev_factory_future = asyncio.Future()
        dev_factory_future.set_result(mock_agent_instance)
        mock_dev.return_value = dev_factory_future

        # Run the workflow
        prompt = "Dry Run Test"
        final_state = await run_workflow_api(prompt)

        # The graph run returns a GraphRunResult, and the 'output' attribute holds the End() value
        # which in our case is the AgentState
        final_state_data = final_state.output

        # Assertions
        assert "Mocked Result" in final_state_data.research_results
        assert final_state_data.design_blueprint == "Mocked Result"
        assert final_state_data.generated_code == "Mocked Result"
        assert final_state_data.qa_report == "Mocked Result"

        print("✅ Graph transitions successful.")
        print("✅ State preserved across nodes.")
        print(f"Final State History: {len(final_state_data.history)} items.")

if __name__ == "__main__":
    asyncio.run(test_graph_execution())
