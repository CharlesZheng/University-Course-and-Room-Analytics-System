const serverURL = "http://localhost:4321";

document.getElementById("upload-btn").addEventListener("click", handleUpload);

async function handleUpload() {
	const idInput = document.getElementById("dataset-id");
	const fileInput = document.getElementById("file-upload");
	const status = document.getElementById("status");

	status.textContent = "";
	status.className = "";

	const datasetId = idInput.value.trim();
	const file = fileInput.files[0];

	if (!datasetId || !file) {
		status.textContent = "Please provide a dataset ID and select a ZIP file.";
		status.className = "error";
		return;
	}

	const reader = new FileReader();
	reader.onload = async (e) => {
		try {
			const arrayBuffer = e.target.result;
			const uint8Array = new Uint8Array(arrayBuffer);

			const res = await fetch(`${serverURL}/dataset/${datasetId}/sections`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/x-zip-compressed"
				},
				body: uint8Array
			});

			const json = await res.json();
			if (res.ok) {
				status.textContent = `Dataset '${datasetId}' added successfully.`;
				status.className = "success";
				idInput.value = "";
				fileInput.value = "";
				loadDatasets();
			} else {
				status.textContent = `Error: ${json.error}`;
				status.className = "error";
			}
		} catch (err) {
			status.textContent = "Upload failed.";
			status.className = "error";
		}
	};
	reader.readAsArrayBuffer(file);
}

async function loadDatasets() {
	const list = document.getElementById("datasets-list");
	list.innerHTML = "Loading...";

	try {
		const res = await fetch(`${serverURL}/datasets`);
		const json = await res.json();
		list.innerHTML = "";

		if (json.result.length === 0) {
			list.textContent = "No datasets added yet.";
			return;
		}

		for (const ds of json.result) {
			const div = document.createElement("div");
			div.className = "dataset-entry";
			div.innerHTML = `
	  <div>
	    	<strong>ID:</strong> ${ds.id}<br />
		    <span class="dataset-details">
			Kind: ${ds.kind} | Rows: ${ds.numRows}
		</span>
	</div>
	<div>
		<button class="button" onclick="viewDataset('${ds.id}')">View</button>
		<button class="button" onclick="removeDataset('${ds.id}')">Remove</button>
	</div>
`;
			list.appendChild(div);
		}
	} catch (err) {
		list.textContent = "Failed to load datasets.";
	}
}


async function removeDataset(id) {
	const status = document.getElementById("status");
	status.textContent = "";
	status.className = "";

	try {
		const res = await fetch(`${serverURL}/dataset/${id}`, {
			method: "DELETE"
		});
		const json = await res.json();

		if (res.ok) {
			status.textContent = `Dataset '${id}' removed successfully.`;
			status.className = "success";
			loadDatasets();
		} else {
			status.textContent = `Error: ${json.error}`;
			status.className = "error";
		}
	} catch (err) {
		status.textContent = `Failed to remove dataset '${id}'.`;
		status.className = "error";
	}
}

async function viewDataset(id) {
	const status = document.getElementById("status");
	status.textContent = "";
	status.className = "";

	try {
		const res = await fetch(`${serverURL}/dataset/${id}`);
		const json = await res.json();

		if (res.ok) {
			const details = JSON.stringify(json.result, null, 2);
			alert(`Sections for '${id}':\n\n${details}`);
		} else {
			alert(`Error: ${json.error}`);
		}
	} catch (err) {
		alert(`Failed to load dataset '${id}'`);
	}
}


window.removeDataset = removeDataset;
window.onload = loadDatasets;
window.viewDataset = viewDataset;
