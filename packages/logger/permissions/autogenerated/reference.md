## Default Permission

Enables the Delta Comic logger's normal application integration.

Allows the frontend to forward its logs, inspect bounded log tails, list log
files, and export selected logs to a ZIP archive.

#### This default permission set includes the following:

- `allow-write-logs`
- `allow-list-log-files`
- `allow-read-log-file`
- `allow-export-logs`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`logger:allow-export-logs`

</td>
<td>

Enables the export_logs command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:deny-export-logs`

</td>
<td>

Denies the export_logs command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:allow-list-log-files`

</td>
<td>

Enables the list_log_files command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:deny-list-log-files`

</td>
<td>

Denies the list_log_files command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:allow-read-log-file`

</td>
<td>

Enables the read_log_file command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:deny-read-log-file`

</td>
<td>

Denies the read_log_file command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:allow-write-logs`

</td>
<td>

Enables the write_logs command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`logger:deny-write-logs`

</td>
<td>

Denies the write_logs command without any pre-configured scope.

</td>
</tr>
</table>
