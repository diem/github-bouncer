import { Probot } from "probot";
import { Octokit } from "@octokit/core";

export = (app: Probot) => {

  app.on("deployment_status.created", async (context) => {
    // if the deployment was triggered by bors push, and is targeting the release-*, test-*, gha-test-* master, or main branches, allow

    // get default username and user_token, if this user submits a request we will auto approve.
    let username = process.env["APPROVED_USERNAME"];
    let user_token = process.env["APPROVING_USER_TOKEN"];

    // error out if we don't have the info needed to approve a pending deployment (also know as gha workflow job)
    if (username == undefined || user_token == undefined) {
      app.log.error("user name or token is undefined, add the APPROVED_USERNAME and APPROVING_USER_TOKEN to the .env file.");
      throw new Error('Improperly installed, see logs.');
    }

    //verify the push came from our one trusted user and is in the waiting state.
    if (context.payload.deployment_status.creator.login == username
      && context.payload.deployment_status.state == "waiting") {

      //get some info about the pending deployment.
      let target_url = context.payload.deployment_status.target_url;
      let repo = context.payload.repository.name;
      let owner = context.payload.repository.full_name.replace(RegExp('/.*'), "")
      let job_id_string = target_url.replace(RegExp('.*/'), "");
      let job_id: number = parseInt(job_id_string);

      app.log.info("job_id: " + job_id);

      //look up the job from the
      let job = await context.octokit.actions.getJobForWorkflowRun({
        owner: owner,
        repo: repo,
        job_id: job_id,
      });

      //get the run of the job in the workflow that needs approval
      let workflow_run_id = job.data.run_id

      app.log.info("workflow_run_id: " + workflow_run_id);

      let workflow = await context.octokit.actions.getWorkflowRun({
        owner: owner,
        repo: repo,
        run_id: workflow_run_id,
      });

      let branch = workflow.data.head_branch
      app.log.info("match on " + branch);

      //maybe filter branches in the future?
      //branch.search('^.*/release-[^/]*$|^.*/test[^/]*$|^.*/gha-test-[^/]*$|^.*/master$|^.*/main') != -1) {


      //get pending deployment for the workflow run.
      let pending = await context.octokit.actions.getPendingDeploymentsForRun({
        owner: owner,
        repo: repo,
        run_id: workflow_run_id,
      });

      let branch_protect = await context.octokit.repos.getBranchProtection({
        owner: owner,
        repo: repo,
        branch: branch || "",
      })
      let restricted = !branch_protect.data.allow_force_pushes?.enabled
        && branch_protect.data.required_linear_history?.enabled;
      //doesn't exist on most github accounts.
      //&& branch_protect.data.restrictions?.users[0].login == username;

      app.log.info("Branch " + branch + " is " + (restricted ? "restricted" : "not restricted") + "with no force pushes and linear history");

      //look up the environment ids, and filter an environments out that lack ids.  Assuming ids are always positive :shrug:
      let data = Array.from(new Set(pending.data.map(env => env.environment.id == undefined ? -1 : env.environment.id).filter(val => val != -1)));
      app.log.info("pending deployment: " + JSON.stringify(pending.data, null, 2));

      //can the current user approve... since the user is a bot the answer is sadly always no.   maybe this'll change in the future.
      let can_approve = !pending.data.find(env => env.current_user_can_approve == false);
      if (!can_approve) {
        app.log.error("current user can not approve");
      }

      //approve the build with a fresh octokit using the APPROVING_USER_TOKEN
      let clientWithAuth = new Octokit({
        auth: user_token,
      })

      let rep = await clientWithAuth.request('POST /repos/' + owner + '/' + repo + '/actions/runs/' + workflow_run_id + '/pending_deployments', {
        environment_ids: data,
        state: 'approved',
        comment: 'Auto approved by bouncer.'
      });
      app.log.info("response: " + rep.data);

    }
  });
};
